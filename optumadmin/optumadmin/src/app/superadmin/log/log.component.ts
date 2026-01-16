import { Component, OnInit, ViewChild, Injectable, Inject } from "@angular/core";
import { Firestore, collection, collectionData, query, orderBy, limit, doc, deleteDoc } from '@angular/fire/firestore';

import { MatDialog } from "@angular/material/dialog";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { DataSource } from "@angular/cdk/collections";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { map } from "rxjs/operators";
import { Observable, of as observableOf, merge } from "rxjs";
// import { LogdetailComponent } from "../../_dialogs/logdetail/logdetail.component";
// import { LoggerService } from "src/app/logger.service";

@Component({
  selector: "app-log",
  templateUrl: "./log.component.html",
  styleUrls: ["./log.component.css"]
})
export class LogComponent implements OnInit {
  @ViewChild(MatPaginator, { static: true })
  paginator: MatPaginator;
  @ViewChild(MatSort, { static: true })
  sort: MatSort;

  filter: string;
  //  dataSource: InfotableDataSource;
  dataSource: MatTableDataSource<LogtableItem>;

  /** Columns displayed in the table. Columns IDs can be added, removed, or reordered. */
  displayedColumns = ["datetime", "message", "meta", "source", "level", "functions"];

  public options: any;

  entries: any;
  constructor(private firestore: Firestore, public dialog: MatDialog) {
    this.dataSource = new InfotableDataSource();
    this.dataSource.data = [];
    this.options = "option";
  }
  getbillingagreementslogs(ba) {
    const logsCol = collection(this.firestore, `ppbillingagreements/${ba.id}/logs`);
    collectionData(logsCol, { idField: 'id' }).subscribe(x => {
      if (x) {
        console.log(x);
        ba.logs = x;
      }
    });
  }

  // openDialog() {
  //   const dialogRef = this.dialog.open(LogdetailComponent, {
  //     data: { name: "austin" }
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     console.log(`Dialog result: ${result}`);
  //   });
  // }
  // openEditDialog(logitem) {
  //   if (!logitem) {
  //     logitem = {};
  //   }

  //   const dialogRef = this.dialog.open(LogdetailComponent, {
  //     data: logitem
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     console.log(`Dialog result: ${result}`);
  //   });
  // }
  ngOnInit() {
    const logsCol = collection(this.firestore, 'logs');
    const logsQuery = query(logsCol, orderBy('datetime', 'desc'), limit(100));

    collectionData(logsQuery, { idField: 'id' }).subscribe(x => {
      this.dataSource.data = x as any;

      this.dataSource.filter = this.filter;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }
  // tslint:disable-next-line:use-life-cycle-interface

  applyFilter(filterValue: string) {
    filterValue = filterValue.trim(); // Remove whitespace
    filterValue = filterValue.toLowerCase(); // Datasource defaults to lowercase matches
    this.dataSource.filter = filterValue;
  }

  deleteLog(id) {
    console.log("delete " + id);
    const logDoc = doc(this.firestore, `logs/${id}`);
    deleteDoc(logDoc);
  }
}

// TODO: Replace this with your own data model type
export interface LogtableItem {
  datetime: any;
  message: string;
  source: string;
  level: string;
  meta: any;
}

export class InfotableDataSource extends MatTableDataSource<LogtableItem> {
  data: LogtableItem[];

  constructor() {
    super();
  }

  disconnect() {}
}

function compare(a, b, isAsc) {
  return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
}
