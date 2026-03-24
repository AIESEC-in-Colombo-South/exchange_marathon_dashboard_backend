import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./config.js";
function getServiceAccount() {
    if (!config.firebase.serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
    }
    return JSON.parse(config.firebase.serviceAccountJson);
}
export function db() {
    if (!getApps().length) {
        initializeApp({ credential: cert(getServiceAccount()) });
    }
    return getFirestore();
}
