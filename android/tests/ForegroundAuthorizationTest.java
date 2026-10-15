package io.github.celconac.twa;

public final class ForegroundAuthorizationTest {
    static void require(boolean value, String reason) { if (!value) throw new AssertionError(reason); }
    public static void main(String[] args) {
        ForegroundAuthorization handoff = new ForegroundAuthorization();
        require(handoff.defer(true, false), "A connect tap from Chrome must foreground the native owner first");
        require(handoff.resume(true), "Native resume starts the pending chooser");
        require(!handoff.resume(true), "Duplicate onNewIntent/onResume cannot start two choosers");
        require(!handoff.resume(true), "Returning from Google must not reopen the chooser");
        require(!handoff.defer(false, false), "Silent refresh must keep the tracker in front");
        require(!handoff.resume(true), "Silent refresh does not queue interactive work");
        require(handoff.defer(true, false), "Another explicit connect can request foreground");
        handoff.cancel();
        require(!handoff.resume(true), "Sign-out while waiting cancels the chooser");
        require(handoff.defer(true, false), "New connect request is independent of cancelled work");
        require(!handoff.resume(false), "Navigation or account change invalidates the old request");
        handoff.cancel();
        require(!handoff.defer(true, true), "A resumed owner can launch Google immediately");
        System.out.println("PASS: Chrome-to-native authorization handoff, duplicate lifecycle events, silent refresh and cancellation");
    }
}
