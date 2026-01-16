import { Component, OnInit, ViewChild, Inject, Input, ElementRef, AfterViewInit } from "@angular/core";
import { MatTableDataSource } from "@angular/material/table";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSort } from "@angular/material/sort";
import { MatPaginator } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatAutocomplete } from "@angular/material/autocomplete";
import { MatChipInputEvent } from "@angular/material/chips";
import { Firestore, collection, collectionData, doc, deleteDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Auth, createUserWithEmailAndPassword, sendEmailVerification } from '@angular/fire/auth';
import { map, startWith } from "rxjs/operators";
import { FormControl } from "@angular/forms";
import { Observable } from "rxjs";
import { COMMA, ENTER } from "@angular/cdk/keycodes";
import { HttpClient } from "@angular/common/http";

@Component({
    selector: "app-users",
    templateUrl: "./users.component.html",
    styleUrls: ["./users.component.css"]
})
export class UsersComponent implements OnInit {
    @ViewChild(MatPaginator, { static: true })
    paginator: MatPaginator;
    @ViewChild(MatSort, { static: true })
    sort: MatSort;

    filter: string;
    dataSource: MatTableDataSource<any>;

    /** Columns displayed in the table. Columns IDs can be added, removed, or reordered. */
    displayedColumns = ["uid", "name", "lastLogin", "email", "rollen","functions"];

    public options: any;
    authState: any;
    entries: any;

    constructor(
        private firestore: Firestore,
        private auth: Auth,
        public http: HttpClient,
        public dialog: MatDialog,
        public snackBar: MatSnackBar
    ) {
        this.dataSource = new UsersDataSource();
        this.dataSource.data = [];
        const logCol = collection(this.firestore, 'log');
        this.entries = collectionData(logCol, { idField: 'id' });
        this.options = "option";
    }

    ngOnInit() {
        const usersCol = collection(this.firestore, 'users');
        collectionData(usersCol, { idField: 'id' }).subscribe(x => {
            this.dataSource.data = <any>x;
            console.log("users ", x);
            this.dataSource.filter = this.filter;
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;
        });
    }

    ngAfterViewInit() {}

    applyFilter(filterValue: string) {
        filterValue = filterValue.trim(); // Remove whitespace
        filterValue = filterValue.toLowerCase(); // Datasource defaults to lowercase matches
        this.dataSource.filter = filterValue;
    }

    deleteLog(id, uid) {
        console.log("delete " + id);
        const userDoc = doc(this.firestore, `users/${id}`);
        deleteDoc(userDoc);
        this.http.get("https://us-central1-pkotool.cloudfunctions.net/deluser?uid=" + uid).subscribe(x => {
            console.log("deluser", x);
        });
    }

    emailSignUp(e, email: string, password: string, name: string, role: string, automaten: string, gruppen: string, abrechnung: boolean) {
        return createUserWithEmailAndPassword(this.auth, email, password)
            .then(authState => {
                this.authState = authState;
                sendEmailVerification(authState.user)
                    .then(success => {
                        console.log("registered: ", authState.user);
                        if (!gruppen) gruppen = "";
                        if (!abrechnung) abrechnung = false;
                        const u = {
                            uid: authState.user.uid,
                            registerDate: new Date().getTime(),
                            lastLogin: new Date().getTime(),
                            mail: email,
                            name: name,
                            role: role
                        };
                        console.log("user: ", u);
                        const userDoc = doc(this.firestore, `users/${u.uid}`);
                        setDoc(userDoc, <any>u)
                            .then(yx => {
                                this.http.get("https://us-central1-pkotool.cloudfunctions.net/setuserclaims").subscribe(x => {
                                    console.log("userclaims set", x);
                                });

                                this.snackBar.open("user created", "", { duration: 12000 });
                            });
                    })
                    .catch(err => {
                        this.snackBar.open(err, "", { duration: 12000 });
                    });
            })
            .catch(error => this.snackBar.open(error, "", { duration: 12000 }));
    }

    public saveNewPass(newpass2, newpass) {
        if (newpass2 !== newpass) {
            alert("Password confirmation incorrect");
            return;
        }
    }

    openDialog(user): void {
        console.log("opendlg", user);
        const dialogRef = this.dialog.open(DialogUser, {
            width: "650px",
            data: user
        });

        dialogRef.afterClosed().subscribe(u => {
            console.log("The dialog was closed", u);
            if (!u.id) {
                if (u.password !== "") {
                    this.emailSignUp(null, u.email, u.password, u.name, u.role, u.automaten, u.gruppen, u.abrechnung);
                    return;
                }
            }
            const usere = {
                mail: u.email,
                name: u.name,
                role: u.role,
                automaten: u.automaten,
                gruppen: u.gruppen,
                abrechnung: u.abrechnung
            };
            console.log("user: ", usere);
            const userDoc = doc(this.firestore, `users/${u.id}`);
            updateDoc(userDoc, <any>usere)
                .then(yx => {
                    this.http.get("https://us-central1-flashinfo-2094d.cloudfunctions.net/setuserclaims").subscribe(x => {
                        console.log("userclaims set", x);
                    });
                });
        });
    }
}

export interface DialogData {
    name: any;
    mail: any;
    automaten: any;
    gruppen: any;
    role: string;
    password: string;
    abrechnung: boolean;
    id: string;
}

@Component({
    selector: "dialog-user",
    templateUrl: "userdialog.html"
})
export class DialogUser implements AfterViewInit {
    txtmailregister: string;
    txtpassregister: string;
    txtrollen: string;
    txtname: string;
    txtautomaten: string;
    txtgruppen: string;
    chkabrechnung: boolean;
    txtid: string;

    options = {};
    visible = true;
    selectable = true;
    removable = true;
    addOnBlur = true;
    allFruits: string[] = ["Hamburg", "Bocholt", "Berlin", "München", "Frankfurt", "Stuttgart", "Freiburg", "Fester Standort", "Münzprüfer", "Event", "Vermietung", "Spiegel"];

    readonly separatorKeysCodes: number[] = [ENTER, COMMA];
    @ViewChild("auto", { static: true }) matAutocomplete: MatAutocomplete;
    filteredFruits: Observable<string[]>;
    fruits: any[] = [];
    @ViewChild("fruitInput", { static: true }) fruitInput: ElementRef<HTMLInputElement>;
    fruitCtrl = new FormControl();

    selected(event: MatAutocompleteSelectedEvent): void {
        console.log("selected ", event);
        if (!this.txtgruppen) this.txtgruppen = "";
        this.fruits.push({ name: event.option.value });
        this.fruitInput.nativeElement.value = "";
        this.fruitCtrl.setValue(null);
        this.txtgruppen += event.option.value.trim() + ",";
    }

    add(event: MatChipInputEvent): void {
        if (!this.txtgruppen) this.txtgruppen = "";
        if (event.value === "") {
            return;
        }

        const input = event.input;
        const value = event.value;
        this.txtgruppen += value.trim() + ",";
        console.log("add ", value.trim(), event);
        if ((value || "").trim()) {
            this.fruits.push({ name: value.trim() });
        }
        if (input) {
            input.value = "";
        }
    }

    remove(fruit: any): void {
        const index = this.fruits.indexOf(fruit);

        if (index >= 0) {
            this.fruits.splice(index, 1);
        }

        this.txtgruppen = this.txtgruppen.replace(fruit.name + ",", "").replace(fruit.name, "");
    }

    private _filter(value: string): string[] {
        const filterValue = value.toLowerCase();
        return this.allFruits.filter(fruit => fruit.toLowerCase().indexOf(filterValue) === 0);
    }

    constructor(
        public dialogRef: MatDialogRef<DialogUser>,
        @Inject(MAT_DIALOG_DATA) public data: DialogData
    ) {
        console.log("opendataconstr ", data, this.txtmailregister);
        console.log(" this.txtrollen", this.txtrollen);
        if (this.data) {
            this.txtid = this.data.id;
            this.txtmailregister = this.data.mail;
            this.txtpassregister = this.data.password;
            this.txtname = this.data.name;
            this.txtautomaten = this.data.automaten;
            this.txtgruppen = this.data.gruppen;
            this.txtrollen = this.data.role;
            this.chkabrechnung = this.data.abrechnung;
        }
        this.filteredFruits = this.fruitCtrl.valueChanges.pipe(
            startWith(null),
            map((fruit: string | null) => (fruit ? this._filter(fruit) : this.allFruits.slice()))
        );

        if (this.txtgruppen) {
            let tags = this.txtgruppen.split(",");
            this.fruits = [];
            for (let t = 0; t < tags.length; t++) {
                if (tags[t] !== "") {
                    this.fruits.push({ name: tags[t] });
                    console.log("tags", tags[t]);
                }
            }
        }
    }

    ngAfterViewInit() {}

    close() {
        this.dialogRef.close();
    }

    save(e, email: string, password: string, name: string, role: string, automaten: string, gruppen: string, abrechnung: boolean) {
        e.preventDefault();
        this.dialogRef.close({ id: this.txtid, email: email, password: password, name: name, role: this.txtrollen, automaten: automaten, gruppen: gruppen, abrechnung: abrechnung });
    }
}

export class User {
    public name: string;
    public company: string;
    public street: string;
    public postcode: string;
    public city: string;
    public country: string;
    public taxid: string;
    email: string;
    lastLogin: any;
    registerDate: any;
    provider: string;
    uid: string;
    vms: any;
}

export class UsersDataSource extends MatTableDataSource<any> {
    data: any[] = [];

    constructor() {
        super();
    }

    disconnect() {}
}

function compare(a: number, b: number, isAsc: any) {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
