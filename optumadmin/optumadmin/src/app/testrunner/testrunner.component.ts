import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, query, where, orderBy } from '@angular/fire/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-testrunner',
  templateUrl: './testrunner.component.html',
  styleUrls: ['./testrunner.component.scss']
})
export class TestrunnerComponent implements OnInit {
  vms: any;
  SERVER = "https://us-central1-optum-80593.cloudfunctions.net";  // "http://localhost:5001";
  machinetypes: any;
  machine: any;
  customers: any;
  customer: any;
  count = 3;
  constructor(private firestore: Firestore, public http: HttpClient, public snackBar: MatSnackBar, public sanitizer: DomSanitizer) {
    const machinetypesQuery = query(collection(this.firestore, 'machinetypes'), where('enabled', '==', true));
    collectionData(machinetypesQuery, { idField: 'id' }).subscribe(x => {
      console.log('machinetypes', x);
      this.machinetypes = x;
      this.machine = this.machinetypes[0];
    });

    const customersCol = collection(this.firestore, 'customers');
    collectionData(customersCol, { idField: 'id' }).subscribe(x => {
      console.log('customers', x)
      this.customers = x;

      this.customer = this.customers[0].id;
    });
  }

  ngOnInit(): void {



    const vmsQuery = query(collection(this.firestore, '/states/vmsgce/vms'), orderBy('id'));
    collectionData(vmsQuery, { idField: 'id' }).subscribe(x => {
      console.log('vmsgce', x)
      this.vms = x;
      // cpuPlatform
      // "Unknown CPU Platform"
      // id
      // "4447206542485700377"
      // lastStartTimestamp
      // "2021-08-04T09:35:43.817-07:00"
      // lastStopTimestamp
      // "2021-08-04T10:20:07.262-07:00"
      // machineType
      // "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/us-central1-a/machineTypes/e2-medium"
      // name
      // "instance-9"
      // networkinterface
      // accessConfigs
      // 0
      // kind
      // "compute#accessConfig"
      // name
      // "External NAT"
      // networkTier
      // "PREMIUM"
      // type
      // "ONE_TO_ONE_NAT"
      // fingerprint
      // "YNf3cChCBDU="
      // kind
      // "compute#networkInterface"
      // name
      // "nic0"
      // network
      // "https://www.googleapis.com/compute/v1/projects/optum-80593/global/networks/default"
      // networkIP
      // "10.128.0.12"
      // stackType
      // "IPV4_ONLY"
      // subnetwork
      // "https://www.googleapis.com/compute/v1/projects/optum-80593/regions/us-central1/subnetworks/default"
      // state
      // "TERMINATED"
      // zone
      // "https://www.googleapis.com/compute/v1/projects/optum-80593/zones/us-central1-a"
    });


  }



  loglines = [""];
  starttestvm(clusterid: any = null) {

    console.log('starttestvm', this.customer, this.machine);
    if (!clusterid) clusterid = (Math.random() + 1).toString(36).substring(2);

    //  varhttps://www.googleapis.com/compute/v1/projects/optum-80593/zones/europe-west1-b/machineTypes/n2-highmem-16"
    var payload = {
      customerid: this.customer,
      machinetype: this.machine.name,
      clusterid: clusterid,
      jobid: (Math.random() + 1).toString(36).substring(2),
    }
    // this.SERVER = "http://localhost:5001/optum-80593/us-central1"
    console.log('create vm', payload)
    this.http.post(this.SERVER + "/testInstance", payload).subscribe(x => {
      console.log('vm name', (x as any).id);
      // this.vms = x;
      var str = (x as any).id;
      this.loglines.push(str as string);
      //      this.afs.doc("machines/" + str).set({ state: "starting...", vmname: str })
    });

    // this.http.get(this.SERVER + "/testInstance").subscribe(x => {
    //   console.log('vm name', (x as any).id);
    //   var str = (x as any).id;
    //   this.loglines.push(str as string);
    // });



  }
  stopVM(vm: any) {

  }
  starttestcluster() {

    var clusterid = (Math.random() + 1).toString(36).substring(2);
    for (var i = 0; i < this.count; i++) {
      (async () => await new Promise(resolve => setTimeout(resolve, 2000)))();
      console.log('startvm ' + i)
      this.starttestvm(clusterid);
    }
    // this.http.get(this.SERVER + "/creatcluster").subscribe(x => {
    //   console.log('vm name', (x as any).id);
    //   // this.vms = x;
    //   this.logline = (x as any).id;
    // });

  }


  selected(e: any) {
    console.log('selected', e)
  }

}
