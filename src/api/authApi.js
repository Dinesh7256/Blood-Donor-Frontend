import client from './client.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from '@firebase/auth';
import { auth } from '../config/firebase.js';

export const authApi = {
  registerUser: async (idToken, name) => {
    const response = await client.post('/auth/register', { idToken, name });
    return response.data;
  },

  loginUser: async (idToken) => {
    const response = await client.post('/auth/login', { idToken });
    return response.data;
  },

  // Firebase registration with email and password
  firebaseRegister: async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    return { idToken, user: userCredential.user };
  },

  // Firebase login with email and password
  firebaseLogin: async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    return { idToken, user: userCredential.user };
  },
};
