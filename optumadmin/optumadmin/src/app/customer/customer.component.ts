import { HttpClient } from "@angular/common/http";
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, Inject } from "@angular/core";
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, where } from '@angular/fire/firestore';

// import { DialogUser } from "../superadmin/users/users.component";
import { ENTER, COMMA } from "@angular/cdk/keycodes";
import { Observable } from "rxjs";
import { FormControl } from "@angular/forms";
import { finalize, startWith, map } from "rxjs/operators";
import { MatAutocomplete, MatAutocompleteSelectedEvent } from "@angular/material/autocomplete";
import { MatChipInputEvent } from "@angular/material/chips";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "app-customer",
  templateUrl: "./customer.component.html",
  styleUrls: ["./customer.component.scss"]
})
export class CustomerComponent implements OnInit {

  prioitems = ["normal", "schnell"];

  koordinatoritems = ["mitarbeiter1", "mitarbeiter 2", "mitarbeiter 3", "mitarbeiter 4"];

  statusitems = ["aktiv", "pause"];
  status: any;

  entries: any;
  newproject = { name: "projektname" };

  projects: any;

  project: any;
  createEntry = false;
  newentry = { state: 'Offen' };
  readonly SERVER = "https://us-central1-optum-80593.cloudfunctions.net";
  readonly paymentSuccessUrl = `${this.SERVER}/paymentSuccess`;
  paymentPackages = [
    {
      id: "basic",
      name: "Token Package S",
      tokens: 500,
      price: 100,
      description: "500 tokens for running Optum AI workloads"
    },
    {
      id: "standard",
      name: "Token Package M",
      tokens: 3000,
      price: 500,
      description: "3000 tokens for running Optum AI workloads"
    },
    {
      id: "premium",
      name: "Token Package XL",
      tokens: 20000,
      price: 2500,
      description: "20000 tokens for running Optum AI workloads"
    }
  ];
  checkoutLoading: Record<string, boolean> = {};
  checkoutError: string | null = null;
  constructor(private firestore: Firestore, private route: ActivatedRoute, private http: HttpClient) {
    console.log('customer component');
    const customersCol = collection(this.firestore, 'customers');
    collectionData(customersCol, { idField: 'id' }).subscribe(x => {
      console.log('customers', x)
      this.projects = x;
    });


  }


  ngOnInit() {
    this.route.queryParams.subscribe(async (x) => {
      // ?projekt=c64d0dab-d965-4b60-6b93-08d92ce1f00c&template=8129b99d-d963-4040-81d2-ab977e6a225f
      console.log('params', x)
      const customerDoc = doc(this.firestore, 'customers', x.id);
      docData(customerDoc).subscribe(data => {
        console.log('customers', data)
        this.project = data;
        this.project.id = x.id;
        const entriesCol = collection(this.firestore, 'customers', x.id, 'entries');
        collectionData(entriesCol, { idField: 'id' }).subscribe(y => {
          console.log('customers entries', y)
          this.entries = y;
        });

      });
    });
  }
  formatPackagePrice(price: number): string {
    return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)}€`;
  }
  startCheckout(packageId: string): void {
    if (!this.project?.id) {
      console.warn('Customer information is missing. Cannot start checkout.');
      this.checkoutError = "Customer information is missing. Please reload and try again.";
      return;
    }
    const selectedPackage = this.paymentPackages.find(pkg => pkg.id === packageId);
    if (!selectedPackage) {
      this.checkoutError = "Invalid package selected.";
      return;
    }
    this.checkoutError = null;
    this.checkoutLoading[packageId] = true;

    const payload = {
      packageId: selectedPackage.id,
      customerId: this.project.id,
      successUrl: this.paymentSuccessUrl,
      cancelUrl: this.buildCancelUrl()
    };

    this.http.post<{ url?: string; sessionId?: string }>(`${this.SERVER}/createCheckoutSession`, payload)
      .pipe(finalize(() => {
        this.checkoutLoading[packageId] = false;
      }))
      .subscribe({
        next: (session) => {
          if (session?.url) {
            window.location.href = session.url;
          } else if (session?.sessionId) {
            window.location.href = `${this.paymentSuccessUrl}?session_id=${session.sessionId}`;
          } else {
            this.checkoutError = "Checkout session created but no redirect URL was returned.";
          }
        },
        error: (error) => {
          console.error('Error creating checkout session', error);
          this.checkoutError = "Failed to start checkout. Please try again.";
        }
      });
  }
  private buildCancelUrl(): string {
    if (typeof window !== "undefined" && window.location) {
      const origin = window.location.origin;
      return `${origin}/customer?id=${this.project?.id ?? ""}`;
    }
    return "/";
  }
  async submitEntry(f: any, ne: any) {
    console.log('submitenry', f, ne);
    var meta = { createdate: new Date().getTime() };
    var mergedObj = { ...ne, meta };

    mergedObj.invoicedate = mergedObj.invoicedate?.getTime();
    mergedObj.orderdate = mergedObj.orderdate?.getTime();
    mergedObj = JSON.parse(JSON.stringify(mergedObj));
    console.log('entry', mergedObj, "customers/" + this.project.id + "/entries/");


    const entriesCol = collection(this.firestore, 'customers', this.project.id, 'entries');
    var result = await addDoc(entriesCol, mergedObj);
    console.log('result: ', result);
    this.createEntry = false;
  }
  onOpenChange(event: any) {
    console.log('onOpenChange', event);

  }
  openDialog(step: any): void {
    console.log("opendlg", step);

  }
}

// dlgstep

export interface DialogData {
  nr: any;
  description: any;
  LZ: any;
  status: any;
  Abteilung: string;
  dlg1: string;
  dlg2: boolean;
  dlg2del: string;
  tage: number;
  t: number;
  Std: number;
  h: number;
  gelei: number;
  Login: string;
  Logout: string;
}

@Component({
  // tslint:disable-next-line:component-selector
  selector: "dialog-step",
  templateUrl: "dlgstep.html"
})
export class DialogStep implements AfterViewInit {
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
  allFruits: string[] = ["Hamburg", "Bocholt", "Berlin", "München", "Frankfurt", "Stuttgart", "Freiburg", "Fester Standort", "Münzprüfer", "Event", "Vermietung", "Spiegel"]; // vorauswahl

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];
  @ViewChild("auto", { static: true }) matAutocomplete: MatAutocomplete | undefined;
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
    console.log("opendataconstr ", data, this.txtmailregister);
    console.log(" this.txtrollen", this.txtrollen);
    if (this.data) {
      // this.txtid = this.data.id;
      // this.txtmailregister = this.data.mail;
      // this.txtpassregister = this.data.password;
      // this.txtname = this.data.name;
      // this.txtautomaten = this.data.automaten;
      // this.txtgruppen = this.data.gruppen;
      // this.txtrollen = this.data.role;
      // this.chkabrechnung = this.data.abrechnung;
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

  save(e: { preventDefault: () => void; }, email: string, password: string, name: string, role: string, automaten: string, gruppen: string, abrechnung: boolean) {
    e.preventDefault();

    // this.dialogRef.close({ id: this.txtid, email: email, password: password, name: name, role: this.txtrollen, automaten: automaten, gruppen: gruppen, abrechnung: abrechnung });
  }
}
