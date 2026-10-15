package io.github.celconac.twa;

/** Prevents requestPostMessageChannel's validation callback from reentering itself. */
final class ChannelGate {
    private boolean validated, navigated, requested;
    void validated(boolean value) { validated = value; }
    void navigationStarted() { navigated = false; requested = false; }
    void navigationFinished() { navigated = true; }
    boolean claimRequest() {
        if (!validated || !navigated || requested) return false;
        // Set before calling the browser: it may synchronously/asynchronously validate again.
        requested = true;
        return true;
    }
    void requestRejected() { requested = false; }
    void disconnected() { validated = false; navigated = false; requested = false; }
}
