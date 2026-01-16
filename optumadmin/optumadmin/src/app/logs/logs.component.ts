import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, deleteDoc, query, orderBy, limit } from '@angular/fire/firestore';
// import { JsonEditorOptions } from "ang-jsoneditor"; // Removed - package not compatible
import { schema } from '../schame.value';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements OnInit {
  logs: any;
  createEntry = false;
  newentry = {};

  // options = new JsonEditorOptions(); // Removed - package not compatible

  constructor(private firestore: Firestore) {

    // TODO: filtern nach projekt etc.
    const logsQuery = query(collection(this.firestore, 'logs'), orderBy('datetime', 'desc'), limit(50));
    collectionData(logsQuery, { idField: 'id' }).subscribe(x => {
      this.logs = x;
    });
  }
  async ngOnInit() {
    // jsoneditor https://github.com/josdejong/jsoneditor/blob/develop/docs/api.md
    // JsonEditor options removed - package not compatible with Angular 18
    // this.options.mode = "view"; //'tree' | 'view' | 'form' | 'code' | 'text';
    // this.options.statusBar = false;
    // this.options.navigationBar = false;
    // this.options.mainMenuBar = true;
    // this.options.search = true;
    // this.options.modes = ["view"];
    // this.options.schema = schema;
  }

  filterproject = "alle";
  filter() {
    console.log('filter', this.filterproject);
    if (this.filterproject == "alle") {
      const logsQuery = query(collection(this.firestore, 'logs'), orderBy('datetime', 'desc'), limit(20));
      collectionData(logsQuery, { idField: 'id' }).subscribe(x => {
        this.logs = x;
      });
    }
    // else {
    //   const logsQuery = query(collection(this.firestore, 'logs'), orderBy('datetime'), where('projectid', '==', this.filterproject));
    //   collectionData(logsQuery, { idField: 'id' }).subscribe(x => {
    //     this.logs = x;
    //   });
    // }
  }
  async submitEntry(f: any, ne: any) {
    console.log('submitenry', f, ne);
    var meta = { createdate: new Date().getTime() };
    var mergedObj = { ...ne, meta };
    console.log('entry', mergedObj);
    const logsCol = collection(this.firestore, 'logs');
    var result = await addDoc(logsCol, mergedObj);
    console.log('result: ', result);
    this.createEntry = false;
  }


  deleteEntry(id: string) {
    const logDoc = doc(this.firestore, 'logs', id);
    deleteDoc(logDoc);
  }



}
