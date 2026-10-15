package io.github.celconac.twa;

/** A Google chooser must have a resumed native activity as its result owner. */
final class ForegroundAuthorization {
    private boolean waiting;
    boolean defer(boolean interactive, boolean resumed) {
        waiting = interactive && !resumed;
        return waiting;
    }
    boolean resume(boolean currentOperation) {
        if (!waiting || !currentOperation) return false;
        waiting = false;
        return true;
    }
    void cancel() { waiting = false; }
}
