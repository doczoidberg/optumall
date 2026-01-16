import { ENTER, COMMA } from '@angular/cdk/keycodes';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, query, orderBy, limit } from '@angular/fire/firestore';
import { FormControl } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { map } from 'traverse';

@Component({
  selector: 'app-vmdetails',
  templateUrl: './vmdetails.component.html',
  styleUrls: ['./vmdetails.component.scss']
})
export class VMDetailsComponent implements OnInit {
  SERVER = "https://us-central1-optum-80593.cloudfunctions.net";  // "http://localhost:5001";


  vms: any;
  newVM = {}
  createVM = false;

  editVM = false;

  currentVM: any;

  machines: any;

  machinelog: any;
  // tslint:disable-next-line:max-line-length
  constructor(private route: ActivatedRoute, private firestore: Firestore, public http: HttpClient, public snackBar: MatSnackBar, public sanitizer: DomSanitizer) {
    this.route.params.subscribe(params => {
      console.log('params', params.id);

      // TODO: where customerid ==T22VDtiCN81Ryjvawibt
      const logsQuery = query(collection(this.firestore, 'machines', params.id, 'logs'), orderBy('localdatetime'));
      collectionData(logsQuery, { idField: 'id' }).subscribe(x => {
        console.log('logs', x)
        this.machinelog = x;

      });

    });

  }
  ngOnInit(): void {
    // throw new Error('Method not implemented.');
  }

  async submitVM(f: any, newvm: any) {
    console.log('submit vm', f, newvm);
    newvm.creditsused = 0;
    var meta = { createdate: new Date().getTime() };
    var mergedObj = { ...newvm, meta };
    const customersCol = collection(this.firestore, 'customers');
    var result = await addDoc(customersCol, mergedObj);
    console.log('result: ', result);
    this.createVM = false;
  }
  showEditDlg(customer: any) {
    this.editVM = true;
    this.currentVM = JSON.parse(JSON.stringify(customer))
  }
  async editVMData(f: any, customer: any) {
    console.log('edit customer', f, customer);
    // customer.creditsused = 0;
    // var meta = { createdate: new Date().getTime() };
    // var mergedObj = { ...customer, meta };
    const customerDoc = doc(this.firestore, 'customers', customer.id);
    var result = await updateDoc(customerDoc, { credits: customer.credits });
    console.log('result: ', result);
    this.editVM = false;
  }

  deleteVM(id: string) {
    const customerDoc = doc(this.firestore, 'customers', id);
    deleteDoc(customerDoc);
  }




}
