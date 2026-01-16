import { ENTER, COMMA } from '@angular/cdk/keycodes';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, setDoc } from '@angular/fire/firestore';
import { FormControl } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { map } from 'traverse';

@Component({
  selector: 'app-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss']
})
export class CustomersComponent implements OnInit {


  customers: any[] = [];
  newcustomer = {}
  createCustomer = false;

  editCustomer = false;
  creditssum = 0;
  creditsusedsum = 0;
  currentcustomer: any;
  // tslint:disable-next-line:max-line-length
  constructor(private firestore: Firestore, public http: HttpClient, public snackBar: MatSnackBar, public sanitizer: DomSanitizer) {
    const customersCol = collection(this.firestore, 'customers');
    collectionData(customersCol, { idField: 'id' }).subscribe(x => {
      console.log('customers', x)
      this.customers = x;

      this.creditssum = 0;
      this.creditsusedsum = 0;
      for (var i = 0; i < this.customers.length; i++) {
        this.creditssum += this.customers[i].credits;
        this.creditsusedsum += this.customers[i].creditsused;

      }

    });
  }
  ngOnInit(): void {
    // throw new Error('Method not implemented.');
  }

  async submitCustomer(f: any, newcustomer: any) {
    console.log('submit customers', f, newcustomer);
    newcustomer.creditsused = 0;
    var meta = { createdate: new Date().getTime() };
    var mergedObj = { ...newcustomer, meta };

    var newid = (Math.random() + 1).toString(36).substring(2);
    const customerDoc = doc(this.firestore, 'customers', newid);
    var result = await setDoc(customerDoc, mergedObj);

    console.log('result: ', result);
    this.createCustomer = false;
  }
  showEditDlg(customer: any) {
    this.editCustomer = true;
    this.currentcustomer = JSON.parse(JSON.stringify(customer))
  }
  async editCustomerData(f: any, customer: any) {
    console.log('edit customer', f, customer);
    // customer.creditsused = 0;
    // var meta = { createdate: new Date().getTime() };
    // var mergedObj = { ...customer, meta };
    const customerDoc = doc(this.firestore, 'customers', customer.id);
    var result = await updateDoc(customerDoc, { credits: customer.credits });
    console.log('result: ', result);
    this.editCustomer = false;
  }

  deleteCustomer(id: string) {
    const customerDoc = doc(this.firestore, 'customers', id);
    deleteDoc(customerDoc);
  }

  fileInput: any;

  openDialog(user: any): void {
    console.log("opendlg", user);
    // const dialogRef = this.dialog.open(DialogProject, {
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
  selector: "dialog-project",
  templateUrl: "dlgproject.html"
})
export class DialogProject implements AfterViewInit {
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
  matAutocomplete: MatAutocomplete | undefined;
  filteredFruits: Observable<string[]> | undefined;
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
    // this.filteredFruits = this.fruitCtrl.valueChanges.pipe(
    //   startWith(null),
    //   map((fruit: string | null) => (fruit ? this._filter(fruit) : this.allFruits.slice()))
    // );

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

//  processData(allText): any {
//     var allTextLines = allText.split(/\r\n|\n/);
//     var headers = allTextLines[0].split(",");
//     var lines = [];

//     // for (var i = 1; i < allTextLines.length; i++) {
//     //   var data = allTextLines[i].split(",");
//     //   if (data.length == headers.length) {
//     //     var tarr = [];
//     //     for (var j = 0; j < headers.length; j++) {
//     //       tarr.push(headers[j] + ":" + data[j]);
//     //     }
//     //     lines.push(tarr);
//     //   }
//     // }
//     // alert(lines);
//     return allTextLines;
//   }
