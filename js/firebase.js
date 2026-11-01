// Firebase (Firestore + Auth) dimuat dari CDN resmi Google, hanya saat dibutuhkan.
// Jika gagal dimuat (offline/diblokir), aplikasi tetap berjalan normal.
import { FIREBASE_CONFIG } from './config.js';

const V = '10.14.1';
const base = `https://www.gstatic.com/firebasejs/${V}/`;
let appP, dbP, authP;

const getApp = () => (appP ||= import(base + 'firebase-app.js').then((m) => m.initializeApp(FIREBASE_CONFIG)));
const getDb = () => (dbP ||= Promise.all([getApp(), import(base + 'firebase-firestore.js')]).then(([app, fs]) => ({ fs, db: fs.getFirestore(app) })));
const getAuthKit = () => (authP ||= Promise.all([getApp(), import(base + 'firebase-auth.js')]).then(([app, au]) => ({ au, auth: au.getAuth(app) })));

const COL = 'pengajuan';
export const STATUSES = [
  { id: 'baru', name: 'Baru' },
  { id: 'dihubungi', name: 'Dihubungi' },
  { id: 'penawaran', name: 'Penawaran' },
  { id: 'deal', name: 'Deal' },
  { id: 'batal', name: 'Batal' },
];

/** Simpan pengajuan pelanggan. Kembalikan id dokumen. */
export async function saveSubmission(data) {
  const { fs, db } = await getDb();
  const ref = await fs.addDoc(fs.collection(db, COL), { ...data, status: 'baru', adminNote: '', createdAt: fs.serverTimestamp() });
  return ref.id;
}

// ---------- khusus admin ----------
export async function onAuth(cb) {
  const { au, auth } = await getAuthKit();
  return au.onAuthStateChanged(auth, cb);
}
export async function signIn() {
  const { au, auth } = await getAuthKit();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await au.signInWithPopup(auth, provider);
  } catch (e) {
    // popup diblokir / tidak didukung (mis. HP, in-app browser) → pakai redirect
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) {
      return au.signInWithRedirect(auth, provider);
    }
    throw e;
  }
}
/** Ambil hasil login redirect (jika ada) agar error-nya bisa ditampilkan. */
export async function redirectResult() {
  const { au, auth } = await getAuthKit();
  return au.getRedirectResult(auth);
}
export async function signOutAdmin() {
  const { au, auth } = await getAuthKit();
  return au.signOut(auth);
}
export async function watchSubmissions(onData, onError) {
  const { fs, db } = await getDb();
  const q = fs.query(fs.collection(db, COL), fs.orderBy('createdAt', 'desc'), fs.limit(300));
  return fs.onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function updateSubmission(id, patch) {
  const { fs, db } = await getDb();
  return fs.updateDoc(fs.doc(db, COL, id), patch);
}
export async function deleteSubmission(id) {
  const { fs, db } = await getDb();
  return fs.deleteDoc(fs.doc(db, COL, id));
}

// ---------- pengaturan harga (dibaca semua pengunjung, diubah admin) ----------
export async function getPriceRules() {
  const { fs, db } = await getDb();
  const snap = await fs.getDoc(fs.doc(db, 'settings', 'pricing'));
  return snap.exists() ? snap.data() : null;
}
export async function savePriceRules(data) {
  const { fs, db } = await getDb();
  return fs.setDoc(fs.doc(db, 'settings', 'pricing'), { ...data, updatedAt: fs.serverTimestamp() });
}

// ---------- galeri proyek (dibaca semua, dikelola admin) ----------
export async function listPortfolio() {
  const { fs, db } = await getDb();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'portfolio'), fs.orderBy('order', 'asc'), fs.limit(120)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addPortfolio(data) {
  const { fs, db } = await getDb();
  return fs.addDoc(fs.collection(db, 'portfolio'), { ...data, createdAt: fs.serverTimestamp() });
}
export async function updatePortfolio(id, patch) {
  const { fs, db } = await getDb();
  return fs.updateDoc(fs.doc(db, 'portfolio', id), patch);
}
export async function deletePortfolio(id) {
  const { fs, db } = await getDb();
  return fs.deleteDoc(fs.doc(db, 'portfolio', id));
}

// ---------- pengaturan umum (settings/<nama>) ----------
export async function getSetting(name) {
  const { fs, db } = await getDb();
  const snap = await fs.getDoc(fs.doc(db, 'settings', name));
  return snap.exists() ? snap.data() : null;
}
export async function saveSetting(name, data) {
  const { fs, db } = await getDb();
  return fs.setDoc(fs.doc(db, 'settings', name), { ...data, updatedAt: fs.serverTimestamp() });
}
