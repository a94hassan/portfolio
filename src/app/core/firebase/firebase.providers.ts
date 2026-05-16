import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { firebaseConfig } from './firebase.config';

function assertValidFirebaseConfig(): void {
  const requiredKeys: Array<keyof typeof firebaseConfig> = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const hasInvalidValue = requiredKeys.some((key) => {
    const value = String(firebaseConfig[key] ?? '').trim();
    return value.length === 0 || value.startsWith('YOUR_');
  });

  if (hasInvalidValue) {
    throw new Error(
      'Firebase configuration is incomplete. Replace placeholder values in src/app/core/firebase/firebase.config.ts before running the app.'
    );
  }
}

export function provideFirebase(): EnvironmentProviders {
  assertValidFirebaseConfig();

  return makeEnvironmentProviders([
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ]);
}
