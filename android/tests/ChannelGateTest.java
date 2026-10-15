package io.github.celconac.twa;

/** Exercises the same reentrant callback sequence as Chrome's ClientManager. */
public final class ChannelGateTest {
    static void require(boolean value, String reason) { if (!value) throw new AssertionError(reason); }
    public static void main(String[] args) {
        ChannelGate gate = new ChannelGate();
        long oldSession = gate.newSession();
        gate.navigationFinished();
        require(!gate.claimRequest(), "Must validate before requesting a port");
        gate.validated(true);
        require(gate.claimRequest(), "First validated page gets a channel");
        // requestPostMessageChannel internally validates again and calls the native callback.
        for (int i=0; i<1000; i++) {
            gate.validated(true);
            require(!gate.claimRequest(), "Repeated validation must not recreate the channel");
        }
        gate.navigationStarted();
        require(!gate.claimRequest(), "No channel before the refreshed page finishes");
        gate.navigationFinished();
        require(gate.claimRequest(), "Refresh establishes one fresh channel");
        gate.validated(true);
        require(!gate.claimRequest(), "Refresh validation also cannot recurse");
        gate.disconnected();gate.navigationFinished();
        require(!gate.claimRequest(), "Disconnected provider must validate again");
        gate.validated(true);require(gate.claimRequest(), "Reconnected provider can establish channel");
        gate.requestRejected();require(gate.claimRequest(), "Explicit rejection permits a later retry");
        long restoredSession = gate.newSession();
        require(!gate.isCurrent(oldSession), "Callbacks from the pre-consent tracker must be ignored");
        require(gate.isCurrent(restoredSession), "New tracker owns the current callbacks");
        gate.navigationFinished();require(!gate.claimRequest(), "Fresh session requires its own origin verification");
        gate.validated(true);require(gate.claimRequest(), "Verified replacement tracker gets a new channel");
        System.out.println("PASS: native validation recursion, refresh, disconnect and rejected request");
    }
}
