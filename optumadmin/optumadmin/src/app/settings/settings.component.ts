import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, doc, updateDoc } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  machinetypes: any;
  constructor(public http: HttpClient, private firestore: Firestore, private route: ActivatedRoute) {

    const machinetypesCol = collection(this.firestore, 'machinetypes');
    collectionData(machinetypesCol, { idField: 'id' }).subscribe(x => {
      console.log('machinetypes', x);
      this.machinetypes = x;
    });

  }

  savemachinetype(m: any, checkbox = false) {
    console.log('savemachinetype', m);
    if (!checkbox) {
      const machineDoc = doc(this.firestore, 'machinetypes', m.id);
      updateDoc(machineDoc, m);
    }
  }
  onCheckChange(m: any) {
    console.log('onCheckChange', m);

    const machineDoc = doc(this.firestore, 'machinetypes', m.id);
    updateDoc(machineDoc, { enabled: m.enabled });
  }
  mtypes = [];
  ngOnInit(): void {

    // this.http.get('https://us-central1-optum-80593.cloudfunctions.net/machinetypes').subscribe(data => {
    //   console.log('machine types', data);
    //   this.mtypes = (data as any).items;
    //   // for (var i = 0; i < this.mtypes.length; i++) {
    //   //   this.afs.collection('machinetypes').add(this.mtypes[i]);
    //   // }
    // });

  }

  save() {
    //this.afs.collection("machinetypes").
  }

}
