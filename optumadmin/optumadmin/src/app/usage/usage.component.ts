import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, Inject } from "@angular/core";
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, query, orderBy, limit } from '@angular/fire/firestore';
import { HttpClient } from "@angular/common/http";

import { ENTER, COMMA } from "@angular/cdk/keycodes";
import { Observable } from "rxjs";
import { FormControl } from "@angular/forms";
import { startWith, map } from "rxjs/operators";
import { MatAutocomplete, MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatChipInputEvent } from "@angular/material/chips";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";

@Component({
  selector: "app-usage",
  templateUrl: "./usage.component.html",
  styleUrls: ["./usage.component.scss"]
})
export class UsageComponent implements OnInit {
  dataSource: any;
  displayedColumns = [];
  constructor(private firestore: Firestore, private auth: Auth, public http: HttpClient, public snackBar: MatSnackBar) { }

  ngOnInit() { }
  applyFilter(filter: any) {

  }
  openDialog(user: any): void {
    console.log("opendlg", user);
    // const dialogRef = this.dialog.open(DialogCustomer, {
    //   width: "650px",
    //   data: user
    // });

    // dialogRef.afterClosed().subscribe((u: any) => {
    //   console.log("The dialog was closed", u);
    //   // this.user = result;
    // });
  }
}

// dlg
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
  // tslint:disable-next-line:component-selector
  selector: "dialog-usage",
  templateUrl: "dlgusage.html"
})
export class DialogCustomer implements AfterViewInit {
  txtmailregister!: string;
  txtpassregister!: string;
  txtrollen!: string;
  txtname!: string;
  txtautomaten!: string;
  txtgruppen!: string;
  chkabrechnung!: boolean;
  txtid!: string;

  options = {};
  visible = true;
  selectable = true;
  removable = true;
  addOnBlur = true;

  allFruits: string[] = ["Stichwort1", "Stichwort2", "Stichwort3", "Stichwort4", "Stichwort5", "Stichwort6"]; // vorauswahl

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  @ViewChild("auto", { static: true })
  matAutocomplete!: MatAutocomplete;
  filteredFruits: Observable<string[]>;
  fruits: any[] = [];
  @ViewChild("fruitInput", { static: true })
  fruitInput!: ElementRef<HTMLInputElement>;
  fruitCtrl = new FormControl();
  selected(event: MatAutocompleteSelectedEvent): void {
    console.log("selected ", event);
    if (!this.txtgruppen) this.txtgruppen = "";
    this.fruits.push({ name: event.option.value });
    this.fruitInput.nativeElement.value = "";
    this.fruitCtrl.setValue(null);
    this.txtgruppen += event.option.value.trim() + ",";

    // this.afs.doc("corporations/" + this.CORPORATION + "/machineinfos/" + this.machineID).update(this.machine);
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
    // this.afs.doc("corporations/" + this.CORPORATION + "/machineinfos/" + this.machineID).update(this.machine);
  }

  remove(fruit: any): void {
    const index = this.fruits.indexOf(fruit);

    if (index >= 0) {
      this.fruits.splice(index, 1);
    }

    this.txtgruppen = this.txtgruppen.replace(fruit.name + ",", "").replace(fruit.name, "");
    // this.afs.doc("corporations/" + this.CORPORATION + "/machineinfos/" + this.machineID).update(this.machine);
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.allFruits.filter(fruit => fruit.toLowerCase().indexOf(filterValue) === 0);
  }
  constructor(@Inject(MAT_DIALOG_DATA) public data: DialogData) {


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


  ngAfterViewInit() { }

}
