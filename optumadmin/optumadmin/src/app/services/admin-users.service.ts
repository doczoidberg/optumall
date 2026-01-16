import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth, User, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { BehaviorSubject, Observable, from, of, firstValueFrom } from 'rxjs';
import { map, shareReplay, switchMap, tap } from 'rxjs/operators';

export interface AdminUser {
  email: string;
  role: string;
  displayName?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUsersService {
  private readonly collectionRef = collection(this.firestore, 'adminUsers');
  private readonly roleSubject = new BehaviorSubject<string | null | undefined>(undefined);

  /**
   * Emits the current role of the authenticated admin user.
   * `undefined` means the role is still loading, `null` means no role assigned.
   */
  readonly role$ = this.roleSubject.asObservable();

  /**
   * Emits true when the current user is an administrator.
   */
  readonly isAdmin$ = this.role$.pipe(map(role => role === 'admin'));

  /**
   * Emits the list of admin users sorted by email.
   */
  readonly adminUsers$: Observable<AdminUser[]> = collectionData(this.collectionRef, {
    idField: 'email'
  }).pipe(
    map(users =>
      (users as AdminUser[]).map(user => ({
        ...user,
        email: (user.email || '').toLowerCase()
      }))
    ),
    map(users => users.sort((a, b) => (a.email || '').localeCompare(b.email || ''))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(private firestore: Firestore, private auth: Auth, private http: HttpClient) {
    authState(this.auth)
      .pipe(
        switchMap(user => this.handleAuthState(user))
      )
      .subscribe({
        next: role => this.roleSubject.next(role),
        error: () => this.roleSubject.next(null)
      });
  }

  /**
   * Creates or updates an admin user entry.
   */
  async upsertUser(email: string, role: string): Promise<{ resetLink: string | null }> {
    const normalizedEmail = email.trim().toLowerCase();
    const docRef = doc(this.firestore, 'adminUsers', normalizedEmail);
    const existingSnapshot = await getDoc(docRef);
    const resetLink = existingSnapshot.exists() ? null : await this.ensureAuthAccount(normalizedEmail);
    await setDoc(
      docRef,
      {
        email: normalizedEmail,
        role,
        updatedAt: serverTimestamp(),
        ...(existingSnapshot.exists() ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );
    return { resetLink };
  }

  /**
   * Updates an existing admin user's role.
   */
  async updateUserRole(email: string, role: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const docRef = doc(this.firestore, 'adminUsers', normalizedEmail);
    await setDoc(
      docRef,
      {
        email: normalizedEmail,
        role,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  /**
   * Deletes an admin user entry.
   */
  async deleteUser(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const docRef = doc(this.firestore, 'adminUsers', normalizedEmail);
    await deleteDoc(docRef);
    await this.deleteAuthAccount(normalizedEmail);
  }

  private handleAuthState(user: User | null): Observable<string | null> {
    if (!user || !user.email) {
      return of(null);
    }

    const normalizedEmail = user.email.toLowerCase();
    const userDocRef = doc(this.firestore, 'adminUsers', normalizedEmail);

    return from(this.ensureUserDocument(user)).pipe(
      switchMap(() =>
        docData(userDocRef).pipe(
          map(data => (data as AdminUser | undefined)?.role ?? null)
        )
      ),
      tap({
        error: () => this.roleSubject.next(null)
      })
    );
  }

  private async ensureUserDocument(user: User): Promise<void> {
    const email = user.email?.toLowerCase();
    if (!email) {
      return;
    }

    const userDocRef = doc(this.firestore, 'adminUsers', email);
    const snapshot = await getDoc(userDocRef);

    const defaultRole = email === 'info@seoaachen.de' ? 'admin' : 'viewer';

    if (!snapshot.exists()) {
      await setDoc(userDocRef, {
        email,
        role: defaultRole,
        displayName: user.displayName ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return;
    }

    const data = snapshot.data() as AdminUser;
    const updatePayload: Partial<AdminUser> & { updatedAt: unknown } = {
      updatedAt: serverTimestamp()
    };

    if (!data?.role) {
      updatePayload.role = defaultRole;
    }

    if (!data?.displayName && user.displayName) {
      updatePayload.displayName = user.displayName;
    }

    if (Object.keys(updatePayload).length > 1) {
      await updateDoc(userDocRef, updatePayload);
    }
  }

  private async ensureAuthAccount(email: string): Promise<string | null> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      return null;
    }
    const idToken = await currentUser.getIdToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${idToken}`
    });

    try {
      const response = await firstValueFrom(
        this.http.post<{ resetLink?: string | null }>(
          'https://us-central1-optum-80593.cloudfunctions.net/createAdminUser',
          { email },
          { headers }
        )
      );
      return response.resetLink ?? null;
    } catch (error) {
      console.error('ensureAuthAccount failed', error);
      return null;
    }
  }

  private async deleteAuthAccount(email: string): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      return;
    }
    const idToken = await currentUser.getIdToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${idToken}`
    });

    try {
      await firstValueFrom(
        this.http.post(
          'https://us-central1-optum-80593.cloudfunctions.net/deleteAdminUser',
          { email },
          { headers }
        )
      );
    } catch (error) {
      console.error('deleteAuthAccount failed', error);
    }
  }
}
