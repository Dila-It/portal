// Auth state management shared across portal pages

function initAuth({ onLogin, onLogout }) {
  auth.onAuthStateChanged(user => {
    if (user) {
      onLogin(user);
    } else {
      onLogout();
    }
  });
}

function signIn(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

function signOut() {
  return auth.signOut();
}
