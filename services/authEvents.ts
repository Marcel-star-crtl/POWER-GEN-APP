// Simple event emitter for auth events
type AuthListener = () => void;

class AuthEventEmitter {
  private listeners: AuthListener[] = [];

  subscribe(listener: AuthListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit() {
    this.listeners.forEach(listener => listener());
  }
}

export const authEvents = new AuthEventEmitter();
