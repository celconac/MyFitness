package io.github.celconac.twa;

import android.accounts.Account;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;
import android.widget.Button;
import android.widget.LinearLayout;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Keeps Chrome's existing origin/storage and delegates authorization to Play services. */
public final class LauncherActivity extends Activity {
    private static final Uri ORIGIN = Uri.parse("https://celconac.github.io");
    private static final String HOME = "https://celconac.github.io/MyFitness/";
    private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
    private int authRequestCode = 6000;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private CustomTabsSession session;
    private CustomTabsClient browserClient;
    private final ChannelGate channelGate = new ChannelGate();
    private boolean validated, navigated, channel, bound, authorizing;
    private long epoch;
    private String pendingId, lastToken;
    private boolean pendingInteractive;
    private final ForegroundAuthorization authorizationHandoff = new ForegroundAuthorization();
    private boolean resumed;
    private static final String AUTHORIZE_ACTION = "io.github.celconac.twa.AUTHORIZE";
    private int sendResult;
    private String stage = "starting";
    private long pendingEpoch;
    private SharedPreferences preferences;
    private Uri launchUri;
    private TextView nativeStatus;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("native-google-session-v1", MODE_PRIVATE);
        launchUri = safeUri(getIntent().getData());
        LinearLayout recovery = new LinearLayout(this);
        recovery.setOrientation(LinearLayout.VERTICAL); recovery.setPadding(32,64,32,32);
        TextView title = new TextView(this); title.setText("myFitness"); title.setTextSize(28);
        nativeStatus = new TextView(this); nativeStatus.setText("Opening your tracker…"); nativeStatus.setTextSize(18);
        Button open = new Button(this); open.setText("Open MyFitness");
        open.setOnClickListener(view -> {
            if (browserClient != null) { launchUri = Uri.parse(HOME); launchPage(); }
            else nativeStatus.setText("Close and reopen MyFitness to reconnect to Chrome.");
        });
        recovery.addView(title); recovery.addView(nativeStatus); recovery.addView(open); setContentView(recovery);
        // A generic Custom Tabs browser may not implement Chrome's TWA message channel.
        // Skip the phone's default browser; never silently fall back to Samsung Internet.
        String provider = CustomTabsClient.getPackageName(this, Collections.singletonList("com.android.chrome"), true);
        if (provider == null) { nativeStatus.setText("Install or update Google Chrome to open myFitness."); return; }
        bound = CustomTabsClient.bindCustomTabsService(this, provider, connection);
        if (!bound) nativeStatus.setText("Could not open Chrome. Update Chrome and reopen MyFitness.");
    }

    private Uri safeUri(Uri uri) {
        if (uri != null && "https".equals(uri.getScheme()) && "celconac.github.io".equals(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getPath() != null
                && uri.getPath().startsWith("/MyFitness/")) return uri;
        return Uri.parse(HOME);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // This action can only continue an in-memory request from our verified message port.
        // Never interpret its URI/extras as an authorization request or a tracker navigation.
        if (AUTHORIZE_ACTION.equals(intent.getAction())) {
            if (resumed) continueForegroundAuthorization();
            return;
        }
        setIntent(intent); launchUri = safeUri(intent.getData());
        if (browserClient != null) launchPage();
    }

    @Override protected void onResume() {
        super.onResume(); resumed = true; continueForegroundAuthorization();
    }

    @Override protected void onPause() { resumed = false; super.onPause(); }

    private void continueForegroundAuthorization() {
        if (!authorizationHandoff.resume(authorizing && pendingEpoch == epoch)) return;
        nativeStatus.setText("Connecting your Google account…");
        authorize();
    }

    private void beginAuthorization() {
        if (!authorizationHandoff.defer(pendingInteractive, resumed)) { authorize(); return; }
        // Place the native owner above Chrome BEFORE starting Google's UI. Otherwise
        // Android can defer its activity result until the user presses Back in Chrome.
        Intent foreground = new Intent(this, LauncherActivity.class).setAction(AUTHORIZE_ACTION)
            .addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { startActivity(foreground); }
        catch (Exception e) { authorizationHandoff.cancel(); finishError("unavailable"); }
    }

    private final CustomTabsServiceConnection connection = new CustomTabsServiceConnection() {
        @Override public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
            browserClient = client; client.warmup(0L);
            launchPage();
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            channelGate.newSession();
            epoch++; authorizing = false; channel = false; validated = false; session = null; browserClient = null; lastToken = null;
        }
    };

    private void launchPage() {
        if (browserClient == null) return;
        // Chrome may dispose the old session when the Google chooser returns to this activity.
        // A new tracker must own a new session; old callbacks cannot affect its port or grant.
        epoch++; authorizing = false; authorizationHandoff.cancel(); channel = false; validated = false; navigated = false;
        long sessionGeneration = channelGate.newSession();
        session = browserClient.newSession(callbackFor(sessionGeneration));
        if (session == null) { nativeStatus.setText("Could not connect to Chrome. Reopen MyFitness."); return; }
        stage = "opening tracker";
        session.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN, ORIGIN, null);
        Uri page = launchUri.getQueryParameter("androidSession") == null
            ? launchUri.buildUpon().appendQueryParameter("androidSession", "1").build() : launchUri;
        // Force a document navigation even when Chrome still has the previous HOME tab.
        page = page.buildUpon().appendQueryParameter("androidLaunch", Long.toString(android.os.SystemClock.elapsedRealtime())).build();
        new TrustedWebActivityIntentBuilder(page).build(session).launchTrustedWebActivity(this);
        // Keep this activity/service connection alive behind Chrome for subsequent refreshes.
    }

    private void requestChannel() {
        if (session == null || !channelGate.claimRequest()) return;
        if (!session.requestPostMessageChannel(ORIGIN, ORIGIN, new Bundle())) channelGate.requestRejected();
    }

    private CustomTabsCallback callbackFor(long sessionGeneration) { return new CustomTabsCallback() {
        @Override public void onRelationshipValidationResult(int relation, Uri origin, boolean result, Bundle extras) {
            main.post(() -> {
                if (!channelGate.isCurrent(sessionGeneration)) return;
                if (relation == CustomTabsService.RELATION_USE_AS_ORIGIN && origin != null
                        && "https".equals(origin.getScheme()) && "celconac.github.io".equals(origin.getHost())
                        && (origin.getPort() == -1 || origin.getPort() == 443)) {
                    validated = result; channelGate.validated(result); requestChannel();
                }
            });
        }
        @Override public void onNavigationEvent(int event, Bundle extras) {
            main.post(() -> {
                if (!channelGate.isCurrent(sessionGeneration)) return;
                if (event == NAVIGATION_STARTED) { epoch++; channel = false; navigated = false; authorizing = false; channelGate.navigationStarted(); }
                if (event == NAVIGATION_FINISHED) { navigated = true; channelGate.navigationFinished(); requestChannel(); }
            });
        }
        @Override public void onMessageChannelReady(Bundle extras) {
            main.post(() -> {
                if (!channelGate.isCurrent(sessionGeneration)) return;
                if (!validated) return;
                channel = true; stage = "tracker channel ready";
                send(new JSONObject(), "myfitness-native-ready", "");
            });
        }
        @Override public void onPostMessage(String message, Bundle extras) {
            main.post(() -> { if (channelGate.isCurrent(sessionGeneration)) receive(message); });
        }
    }; }

    private void send(JSONObject response, String type, String id) {
        if (!channel || !validated || session == null) { stage = "reply waiting for tracker"; return; }
        try { response.put("type", type); response.put("id", id); response.put("version", 1);
            sendResult = session.postMessage(response.toString(), null);
            stage = sendResult == CustomTabsService.RESULT_SUCCESS ? "reply delivered" : "reply delivery failed";
        } catch (Exception ignored) { /* Never log messages: authorization responses contain tokens. */ }
    }

    private void error(String id, String code) {
        JSONObject response = new JSONObject();
        try { response.put("error", code); } catch (Exception ignored) { }
        send(response, "myfitness-native-result", id);
    }

    private void receive(String message) {
        if (!channel || !validated || message == null || message.length() > 4096) return;
        try {
            JSONObject request = new JSONObject(message);
            String id = request.optString("id");
            if (!id.matches("[A-Za-z0-9-]{1,80}") || request.optInt("version") != 1) return;
            switch (request.optString("type")) {
                case "myfitness-native-signout":
                    epoch++; authorizing = false; authorizationHandoff.cancel();
                    // Only a non-secret opt-in flag and pinned account identifiers are persisted.
                    if (!preferences.edit().clear().commit()) { error(id, "signout_pending"); return; }
                    if (lastToken != null) Identity.getAuthorizationClient(this)
                        .clearToken(ClearTokenRequest.builder().setToken(lastToken).build());
                    lastToken = null; send(new JSONObject(), "myfitness-native-result", id); return;
                case "myfitness-native-authorize":
                    boolean interactive = request.optBoolean("interactive", false);
                    if (!interactive && !preferences.getBoolean("enabled", false)) { error(id, "signed_out"); return; }
                    if (authorizing) { error(id, "busy"); return; }
                    epoch++; authorizing = true; pendingId = id; pendingInteractive = interactive; pendingEpoch = epoch;
                    stage = interactive ? "selecting Google account" : "restoring saved Google account";
                    final long operationEpoch = epoch;
                    if (request.optBoolean("invalidate", false) && lastToken != null) {
                        String invalid = lastToken; lastToken = null;
                        Identity.getAuthorizationClient(this).clearToken(ClearTokenRequest.builder().setToken(invalid).build())
                            .addOnSuccessListener(unused -> { if (operationEpoch == epoch) beginAuthorization(); })
                            .addOnFailureListener(e -> { if (operationEpoch == epoch) finishError("unavailable"); });
                    } else beginAuthorization();
            }
        } catch (Exception ignored) { /* Malformed input is ignored. */ }
    }

    private void authorize() {
        if (pendingEpoch != epoch || !authorizing) return;
        AuthorizationRequest.Builder builder = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)));
        String email = preferences.getString("email", "");
        if (pendingInteractive) builder.setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT);
        else if (!email.isEmpty()) builder.setAccount(new Account(email, "com.google"));
        else { finishError("interaction_required"); return; }
        final long current = pendingEpoch;
        Identity.getAuthorizationClient(this).authorize(builder.build())
            .addOnSuccessListener(result -> {
                if (current != epoch || !authorizing) return;
                if (result.hasResolution()) {
                    if (!pendingInteractive) { finishError("interaction_required"); return; }
                    try { authRequestCode = authRequestCode == 65534 ? 6001 : authRequestCode + 1;
                        startIntentSenderForResult(result.getPendingIntent().getIntentSender(), authRequestCode, null, 0, 0, 0); }
                    catch (Exception e) { finishError("interaction_required"); }
                } else verify(result, current);
            })
            .addOnFailureListener(e -> { if (current == epoch) finishError("authorization_failed"); });
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != authRequestCode || !authorizing || pendingEpoch != epoch) return;
        if (resultCode != RESULT_OK) { finishError("cancelled"); return; }
        nativeStatus.setText("Finishing your Google connection…");
        try { verify(Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data), pendingEpoch); }
        catch (Exception e) { finishError("authorization_failed"); }
    }

    private void finishError(String code) {
        if (pendingEpoch != epoch) return;
        authorizing = false; error(pendingId, code);
        nativeStatus.setText("Google connection paused. Open MyFitness to try again.");
    }

    private void verify(AuthorizationResult result, long current) {
        final String accessToken = result.getAccessToken();
        if (accessToken == null || !result.getGrantedScopes().contains(DRIVE_SCOPE)) { finishError("permission_required"); return; }
        network.execute(() -> {
            HttpURLConnection connection = null;
            try {
                // Fixed Google endpoint: no page-supplied URL and no redirect with credentials.
                connection = (HttpURLConnection)new URL("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)").openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
                connection.setRequestProperty("Authorization", "Bearer " + accessToken);
                if (connection.getResponseCode() != 200) throw new Exception("identity_failed");
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                try (InputStream input = connection.getInputStream()) {
                    byte[] bytes = new byte[1024]; int count;
                    while ((count = input.read(bytes)) != -1) {
                        if (buffer.size() + count > 16384) throw new Exception("identity_failed");
                        buffer.write(bytes, 0, count);
                    }
                }
                JSONObject user = new JSONObject(new String(buffer.toByteArray(), StandardCharsets.UTF_8)).getJSONObject("user");
                String identity = user.getString("permissionId"), email = user.getString("emailAddress");
                if (identity.isEmpty() || email.isEmpty()) throw new Exception("identity_failed");
                main.post(() -> {
                    if (current != epoch || !authorizing) return;
                    if (!pendingInteractive && !identity.equals(preferences.getString("identity", ""))) {
                        finishError("account_changed"); return;
                    }
                    if (pendingInteractive && !preferences.edit().putBoolean("enabled", true)
                        .putString("email", email).putString("identity", identity).commit()) {
                        finishError("session_save_failed"); return;
                    }
                    lastToken = accessToken; authorizing = false;
                    nativeStatus.setText("Google connected. Opening your tracker…");
                    // Persisted opt-in is already verified. Restore through a fresh page/session
                    // after external Google UI, rather than replying only to the hidden old tab.
                    if (pendingInteractive) { launchUri = Uri.parse(HOME); launchPage(); return; }
                    JSONObject response = new JSONObject();
                    try { response.put("accessToken", accessToken); response.put("identity", identity);
                        response.put("email", email); response.put("expiresIn", 3000);
                    } catch (Exception ignored) { return; }
                    send(response, "myfitness-native-result", pendingId);
                });
            } catch (Exception e) { main.post(() -> { if (current == epoch) finishError("identity_failed"); }); }
            finally { if (connection != null) connection.disconnect(); }
        });
    }

    @Override protected void onDestroy() {
        channelGate.newSession();
        epoch++; channel = false; lastToken = null;
        if (bound) unbindService(connection);
        network.shutdownNow(); super.onDestroy();
    }
}
