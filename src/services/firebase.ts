import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged, 
  User as FirebaseUser,
  UserCredential
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from "firebase/firestore";

export interface AlertRule {
  id: string;
  type: 'wow_change' | 'star_count' | 'version_bump';
  threshold: number | string;
  isActive: boolean;
}

// Structure for a tracked package
export interface TrackedPackage {
  name: string;
  addedAt: string;
  alertThreshold: number; // e.g. 15 for 15% change
  rules?: AlertRule[];
}

// User Profile structure
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  watchlist: TrackedPackage[];
}

// Config variables
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID
};

const isConfigValid = !!firebaseConfig.apiKey;

let app: any;
let auth: any;
let db: any;
let isSimulationMode = true;

if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isSimulationMode = false;
    console.log("[Daily NPM] Firebase initialized successfully in Cloud Mode.");
  } catch (error) {
    console.error("[Daily NPM] Failed to initialize real Firebase, falling back to Simulation Mode:", error);
    isSimulationMode = true;
  }
} else {
  console.log("[Daily NPM] No VITE_FIREBASE_API_KEY found. Running in local simulation mode.");
}

// --- SIMULATION DATABASE STATE & HELPERS ---
const SIM_USERS_KEY = "dailynpm_sim_users";
const SIM_CURRENT_USER_KEY = "dailynpm_sim_current_user";

interface SimUser {
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  watchlist: TrackedPackage[];
}

function getSimUsers(): Record<string, SimUser> {
  const users = localStorage.getItem(SIM_USERS_KEY);
  return users ? JSON.parse(users) : {};
}

function saveSimUsers(users: Record<string, SimUser>) {
  localStorage.setItem(SIM_USERS_KEY, JSON.stringify(users));
}

function getSimCurrentUser(): SimUser | null {
  const user = localStorage.getItem(SIM_CURRENT_USER_KEY);
  return user ? JSON.parse(user) : null;
}

function saveSimCurrentUser(user: SimUser | null) {
  if (user) {
    localStorage.setItem(SIM_CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SIM_CURRENT_USER_KEY);
  }
}

// Custom listeners for auth state changes in simulation mode
const simAuthListeners: ((user: any) => void)[] = [];
function notifySimAuthListeners(user: any) {
  simAuthListeners.forEach(listener => listener(user));
}

// --- EXPORTED PUBLIC API ---

export { isSimulationMode };

/**
 * Signs up a new user with Email & Password.
 */
export async function signUpUser(email: string, password: string, displayName: string = ""): Promise<any> {
  if (!isSimulationMode && auth && db) {
    const cred: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    
    // Create database entry for user
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName || email.split("@")[0],
      watchlist: []
    });
    
    return { uid: user.uid, email: user.email, displayName: displayName || email.split("@")[0] };
  } else {
    // Simulation signup
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = getSimUsers();
        if (users[email.toLowerCase()]) {
          reject(new Error("Email already in use."));
          return;
        }

        const uid = "sim_" + Math.random().toString(36).substring(2, 9);
        const newUser: SimUser = {
          uid,
          email: email.toLowerCase(),
          password, // note: simple simulation
          displayName: displayName || email.split("@")[0],
          watchlist: [
            { name: "react", addedAt: new Date().toISOString(), alertThreshold: 15 },
            { name: "vite", addedAt: new Date().toISOString(), alertThreshold: 15 }
          ]
        };

        users[email.toLowerCase()] = newUser;
        saveSimUsers(users);
        saveSimCurrentUser(newUser);
        notifySimAuthListeners(newUser);
        resolve(newUser);
      }, 600);
    });
  }
}

/**
 * Signs in an existing user with Email & Password.
 */
export async function signInUser(email: string, password: string): Promise<any> {
  if (!isSimulationMode && auth) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } else {
    // Simulation signin
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = getSimUsers();
        const user = users[email.toLowerCase()];
        if (!user || user.password !== password) {
          reject(new Error("Invalid email or password."));
          return;
        }
        saveSimCurrentUser(user);
        notifySimAuthListeners(user);
        resolve(user);
      }, 500);
    });
  }
}

/**
 * Signs out the current user.
 */
export async function signOutUser(): Promise<void> {
  if (!isSimulationMode && auth) {
    await fbSignOut(auth);
  } else {
    saveSimCurrentUser(null);
    notifySimAuthListeners(null);
  }
}

/**
 * Subscribes to Authentication State Changes.
 */
export function onAuthStateListener(callback: (user: any) => void): () => void {
  if (!isSimulationMode && auth) {
    return fbOnAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch additional user profile details from Firestore
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            callback(userDoc.data());
          } else {
            callback({ uid: user.uid, email: user.email, watchlist: [] });
          }
        } catch {
          callback({ uid: user.uid, email: user.email, watchlist: [] });
        }
      } else {
        callback(null);
      }
    });
  } else {
    simAuthListeners.push(callback);
    // Trigger immediate call with current state
    const currentUser = getSimCurrentUser();
    callback(currentUser);
    // Return unsubscribe function
    return () => {
      const idx = simAuthListeners.indexOf(callback);
      if (idx !== -1) simAuthListeners.splice(idx, 1);
    };
  }
}

/**
 * Tracks a package for the authenticated user.
 */
export async function trackPackage(uid: string, packageName: string, alertThreshold: number = 15): Promise<TrackedPackage[]> {
  const lowerName = packageName.trim().toLowerCase();
  
  if (!isSimulationMode && db) {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User profile not found");
    
    const data = userDoc.data() as UserProfile;
    const currentWatchlist = data.watchlist || [];
    
    if (currentWatchlist.some(p => p.name.toLowerCase() === lowerName)) {
      return currentWatchlist;
    }
    
    const newPackage: TrackedPackage = {
      name: packageName.trim(),
      addedAt: new Date().toISOString(),
      alertThreshold
    };
    
    const updatedList = [...currentWatchlist, newPackage];
    await updateDoc(userRef, { watchlist: updatedList });
    return updatedList;
  } else {
    // Simulation mode
    return new Promise((resolve) => {
      const currentUser = getSimCurrentUser();
      if (!currentUser || currentUser.uid !== uid) {
        resolve([]);
        return;
      }
      
      const watchlist = currentUser.watchlist || [];
      if (watchlist.some(p => p.name.toLowerCase() === lowerName)) {
        resolve(watchlist);
        return;
      }
      
      const newPackage: TrackedPackage = {
        name: packageName.trim(),
        addedAt: new Date().toISOString(),
        alertThreshold
      };
      
      const updatedList = [...watchlist, newPackage];
      currentUser.watchlist = updatedList;
      saveSimCurrentUser(currentUser);
      
      // Sync back to users registry
      const users = getSimUsers();
      if (users[currentUser.email]) {
        users[currentUser.email].watchlist = updatedList;
        saveSimUsers(users);
      }
      
      resolve(updatedList);
    });
  }
}

/**
 * Removes a package from user's tracked watchlist.
 */
export async function untrackPackage(uid: string, packageName: string): Promise<TrackedPackage[]> {
  const lowerName = packageName.trim().toLowerCase();
  
  if (!isSimulationMode && db) {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User profile not found");
    
    const data = userDoc.data() as UserProfile;
    const currentWatchlist = data.watchlist || [];
    const updatedList = currentWatchlist.filter(p => p.name.toLowerCase() !== lowerName);
    
    await updateDoc(userRef, { watchlist: updatedList });
    return updatedList;
  } else {
    // Simulation mode
    return new Promise((resolve) => {
      const currentUser = getSimCurrentUser();
      if (!currentUser || currentUser.uid !== uid) {
        resolve([]);
        return;
      }
      
      const watchlist = currentUser.watchlist || [];
      const updatedList = watchlist.filter(p => p.name.toLowerCase() !== lowerName);
      
      currentUser.watchlist = updatedList;
      saveSimCurrentUser(currentUser);
      
      // Sync back to users registry
      const users = getSimUsers();
      if (users[currentUser.email]) {
        users[currentUser.email].watchlist = updatedList;
        saveSimUsers(users);
      }
      
      resolve(updatedList);
    });
  }
}

/**
 * Updates alert thresholds for a tracked package.
 */
export async function updateAlertThreshold(uid: string, packageName: string, newThreshold: number): Promise<TrackedPackage[]> {
  const lowerName = packageName.trim().toLowerCase();
  
  if (!isSimulationMode && db) {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User profile not found");
    
    const data = userDoc.data() as UserProfile;
    const currentWatchlist = data.watchlist || [];
    
    const updatedList = currentWatchlist.map(p => {
      if (p.name.toLowerCase() === lowerName) {
        return { ...p, alertThreshold: newThreshold };
      }
      return p;
    });
    
    await updateDoc(userRef, { watchlist: updatedList });
    return updatedList;
  } else {
    return new Promise((resolve) => {
      const currentUser = getSimCurrentUser();
      if (!currentUser || currentUser.uid !== uid) {
        resolve([]);
        return;
      }
      
      const watchlist = currentUser.watchlist || [];
      const updatedList = watchlist.map(p => {
        if (p.name.toLowerCase() === lowerName) {
          return { ...p, alertThreshold: newThreshold };
        }
        return p;
      });
      
      currentUser.watchlist = updatedList;
      saveSimCurrentUser(currentUser);
      
      // Sync back to users registry
      const users = getSimUsers();
      if (users[currentUser.email]) {
        users[currentUser.email].watchlist = updatedList;
        saveSimUsers(users);
      }
      
      resolve(updatedList);
    });
  }
}

/**
 * Updates all alert rules for a tracked package.
 */
export async function updateAlertRules(uid: string, packageName: string, newRules: AlertRule[]): Promise<TrackedPackage[]> {
  const lowerName = packageName.trim().toLowerCase();
  
  if (!isSimulationMode && db) {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error("User profile not found");
    
    const data = userDoc.data() as UserProfile;
    const currentWatchlist = data.watchlist || [];
    
    const updatedList = currentWatchlist.map(p => {
      if (p.name.toLowerCase() === lowerName) {
        return { ...p, rules: newRules };
      }
      return p;
    });
    
    await updateDoc(userRef, { watchlist: updatedList });
    return updatedList;
  } else {
    return new Promise((resolve) => {
      const currentUser = getSimCurrentUser();
      if (!currentUser || currentUser.uid !== uid) {
        resolve([]);
        return;
      }
      
      const watchlist = currentUser.watchlist || [];
      const updatedList = watchlist.map(p => {
        if (p.name.toLowerCase() === lowerName) {
          return { ...p, rules: newRules };
        }
        return p;
      });
      
      currentUser.watchlist = updatedList;
      saveSimCurrentUser(currentUser);
      
      // Sync back to users registry
      const users = getSimUsers();
      if (users[currentUser.email]) {
        users[currentUser.email].watchlist = updatedList;
        saveSimUsers(users);
      }
      
      resolve(updatedList);
    });
  }
}
