// vgl https://firebase.googleblog.com/2018/03/cleanse-your-angular-components.html

import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Auth, authState, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { MatSnackBar } from "@angular/material/snack-bar";
import { Firestore } from '@angular/fire/firestore';
import { TranslateService } from "@ngx-translate/core";

@Component({
    selector: "app-login",
    templateUrl: "./login.component.html",
    styleUrls: ["./login.component.css"]
})
export class LoginComponent implements OnInit {
    hidePassword = true;
    errorMessage = '';
    loading = false;

    constructor(
        public translate: TranslateService,
        private auth: Auth,
        private firestore: Firestore,
        public router: Router,
        private route: ActivatedRoute,
        public snackBar: MatSnackBar
    ) {
        // Check if user is already logged in
        authState(this.auth).subscribe(user => {
            if (user) {
                console.log('User already logged in:', user);
                this.router.navigate(['/dashboard']);
            }
        });
    }

    ngOnInit() {
        // Check for any redirect results
        this.checkAuthState();
    }

    checkAuthState() {
        authState(this.auth).subscribe(user => {
            if (user) {
                this.router.navigate(['/dashboard']);
            }
        });
    }

    async loginWithEmail(email: string, password: string) {
        this.errorMessage = '';
        this.loading = true;

        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            console.log('Login successful:', userCredential.user);
            this.snackBar.open('Login successful!', 'Close', { duration: 3000 });
            this.router.navigate(['/dashboard']);
        } catch (error: any) {
            console.error('Login error:', error);
            this.errorMessage = this.getErrorMessage(error.code);
            this.snackBar.open(this.errorMessage, 'Close', { duration: 5000 });
        } finally {
            this.loading = false;
        }
    }

    private getErrorMessage(errorCode: string): string {
        switch (errorCode) {
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
                return 'No account found with this email.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            default:
                return 'Login failed. Please try again.';
        }
    }

    onSuccess(x: any) {
        console.log('onSuccess', x);
    }

    printUser(event: any) {
        console.log('printUser', event);
    }

    printError(event: any) {
        console.error(event);
    }

    // loginWithEmail(mail: string, pass: string) {
    //     console.log("loginuser ", mail, pass);
    //     this.afAuth
    //         .signInWithEmailAndPassword(mail, pass)
    //         .then(x => {
    //             // this.items = this.afs.collection("users", ref => ref.orderBy('Datum', 'desc')).snapshotChanges().map(actions => {
    //             //     return actions.map(a => {
    //             //         const data = a.payload.doc.data();
    //             //         const id = a.payload.doc.id;
    //             //         return { id, ...data };
    //             //     });
    //             // });

    //             if (x?.user?.email === "info@seoaachen.de") {
    //                 console.log("adminlogin");
    //                 this.router.navigate(["/admin"]);
    //             } else {
    //                 this.router.navigate(["/dashboard"]);
    //             }
    //         })
    //         .catch(error => {
    //             this.snackBar.open("Falsche E-Mail Adresse oder Passwort!", "", { duration: 12000 });
    //         });
    // }
    registerWithEmail(mail: any, pass: any) { }
    logout() {
        signOut(this.auth);
        this.router.navigate(["/login"]);
    }

    // private changeCountry(val) {
    //   this.usero.country = val;
    //   console.log(val, this.usero.country);
    //   if (
    //     this.usero.country === "Austria" ||
    //     this.usero.country === "Belgium" ||
    //     this.usero.country === "Bulgaria" ||
    //     this.usero.country === "Croatia" ||
    //     this.usero.country === "Cyprus" ||
    //     this.usero.country === "Czech Republic" ||
    //     this.usero.country === "Denmark" ||
    //     this.usero.country === "Estonia" ||
    //     this.usero.country === "Finland" ||
    //     this.usero.country === "France" ||
    //     this.usero.country === "Greece" ||
    //     this.usero.country === "Hungary" ||
    //     this.usero.country === "Ireland" ||
    //     this.usero.country === "Italy" ||
    //     this.usero.country === "Latvia" ||
    //     this.usero.country === "Lithuania" ||
    //     this.usero.country === "Belgium" ||
    //     this.usero.country === "Bulgaria" ||
    //     this.usero.country === "Croatia" ||
    //     this.usero.country === "Cyprus" ||
    //     this.usero.country === "Czech Republic" ||
    //     this.usero.country === "Luxembourg" ||
    //     this.usero.country === "Malta" ||
    //     this.usero.country === "Netherlands" ||
    //     this.usero.country === "Poland" ||
    //     this.usero.country === "Portugal" ||
    //     this.usero.country === "Romania" ||
    //     this.usero.country === "Slovakia" ||
    //     this.usero.country === "Slovenia" ||
    //     this.usero.country === "Spain" ||
    //     this.usero.country === "Sweden" ||
    //     this.usero.country === "United Kingdom"
    //   )
    //     this.showtax = true;
    //   else this.showtax = false;
    // }

    // public saveNewPass() {
    //     if (this.newpass2 !== this.newpass) {
    //         this.savemessage2 = "Password confirmation incorrect";

    //         return;
    //     }

    //     //    this.afAuth.auth.verifyPasswordResetCode;
    //     this.afAuth
    //         .confirmPasswordReset("code", this.vm.newpass)
    //         .then(x => { })
    //         .catch(err => {
    //             this.snackBar.open(err, "", { duration: 12000 });
    //         });

    //     // ref.changePassword(
    //     //   {
    //     //     email: this.usero.email,
    //     //     oldPassword: this.oldpass,
    //     //     newPassword: this.newpass
    //     //   },
    //     //   error => {
    //     //     if (error) {
    //     //       switch (error.code) {
    //     //         case "INVALID_PASSWORD":
    //     //           this.savemessage2 = "The specified user account password is incorrect.";
    //     //           break;
    //     //         case "INVALID_USER":
    //     //           this.savemessage2 = "The specified user account does not exist.";
    //     //           break;
    //     //         default:
    //     //           this.savemessage2 = "Error changing password: " + error;
    //     //       }
    //     //     } else {
    //     //       this.savemessage2 = "User password changed successfully!";
    //     //     }
    //     //   }
    //     // );
    // }

    public addUser() {
        // this.afAuth.auth.createUserWithEmailAndPassword(this.vm.regmail, this.vm.regpass).then(x => {
        //   this.afAuth.auth
        //     .createUserAndRetrieveDataWithEmailAndPassword(this.vm.regmail, this.vm.regpass)
        //     .then(x => { })
        //     .catch(err => {
        //       this.snackBar.open(err, "", { duration: 12000 });
        //     });
        //   (error, fbauth) => {
        //     if (error) {
        //     } else {
        //       ///standardwerte festlegen
        //       const newuser = {
        //         mail: this.vm.regmail
        //       };
        //       this.afs
        //         .collection("users")
        //         .doc("erew")
        //         .set(newuser);
        //       // let r = new Firebase(this.DBSERVER + "/users/" + this.fbauth.uid);
        //       // r.update({
        //       //   subscription: {
        //       //     diskusage: 0,
        //       //     cputime: 0,
        //       //     typ: "free"
        //       //   }
        //       //          });
        //     }
        //   }
        // );
    }

    // Returns
    get currentUserObservable(): any {
        return authState(this.auth);
    }

    //// Social Auth ////



    //// Email/Password Auth ////

    // emailSignUp(email: string, password: string) {
    //     // return this.afAuth
    //     //     .createUserWithEmailAndPassword(email, password)
    //     //     .then(authState => {
    //     //         this.authState = authState;
    //     //         // user = firebase.auth().currentUser;
    //     //         if (authState)
    //     //             authState.user?.sendEmailVerification()
    //     //                 .then(success => {
    //     //                     console.log("registered: ", authState.user);
    //     //                     if (authState.user) {

    //     //                         const u = {
    //     //                             // = new User();
    //     //                             uid: authState.user.uid,
    //     //                             registerDate: new Date().getTime(),
    //     //                             lastLogin: new Date().getTime(),
    //     //                             mail: authState.user.email,
    //     //                             name: authState.user.email
    //     //                         };
    //     //                         console.log("user: ", u);
    //     //                         this.afs.doc("/users/" + u.uid).set(<any>u);

    //     //                         this.snackBar.open("please verify your email", "", { duration: 12000 });
    //     //                         this.router.navigateByUrl("/dashboard");
    //     //                     }
    //     //                 })
    //     //                 .catch(err => {
    //     //                     this.snackBar.open(err, "", { duration: 12000 });
    //     //                 });
    //     //     })
    //     //     .catch(error => this.snackBar.open(error, "", { duration: 12000 }));
    // }

    // Sends email allowing user to reset password
    resetPassword(email: string) {
        // const auth = (firebase as any).auth();

        // return auth
        //     .sendPasswordResetEmail(email)
        //     .then(() => this.snackBar.open("email sent", "", { duration: 12000 }))
        //     .catch((error: string) => this.snackBar.open(error, "", { duration: 12000 }));
    }
}
