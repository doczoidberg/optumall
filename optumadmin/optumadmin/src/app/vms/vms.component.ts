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
import { Observable } from 'rxjs';
import { finalize, startWith } from 'rxjs/operators';
import { map } from 'traverse';

@Component({
  selector: 'app-vms',
  templateUrl: './vms.component.html',
  styleUrls: ['./vms.component.scss']
})
export class VMsComponent implements OnInit {
  SERVER = "https://us-central1-optum-80593.cloudfunctions.net";  // "http://localhost:5001";


  vms: any;
  newVM = {}
  createVM = false;

  editVM = false;

  currentVM: any;

  machines: any;


  stopped = 0;
  cloudRegions: RegionSummary[] = [];
  filteredCloudRegions: RegionSummary[] = [];
  cloudMachinesLoading = false;
  cloudMachinesError: string | null = null;
  cloudMachinesLastUpdated: string | null = null;
  totalCloudMachines = 0;
  machineCatalogRegions: CatalogRegion[] = [];
  filteredCatalogRegions: CatalogRegion[] = [];
  machineCatalogLoading = false;
  machineCatalogError: string | null = null;
  machineCatalogLastUpdated: string | null = null;
  totalMachineCatalog = 0;
  machineCatalogPriceRelease: string | null = null;
  catalogSummary: CatalogSummary | null = null;
  catalogFilterText = '';
  catalogShowOnlyPriced = false;
  filterText = '';
  selectedCloudRegionIndex = 0;
  selectedCatalogRegionIndex = 0;
  cloudSortColumn: CloudMachineSortColumn = 'name';
  cloudSortDirection: SortDirection = 'asc';
  catalogSortColumn: CatalogSortColumn = 'name';
  catalogSortDirection: SortDirection = 'asc';
  // tslint:disable-next-line:max-line-length
  constructor(private firestore: Firestore, public http: HttpClient, public snackBar: MatSnackBar, public sanitizer: DomSanitizer) {
    const machinesCol = collection(this.firestore, 'machines');
    collectionData(machinesCol, { idField: 'id' }).subscribe(x => {
      console.log('machines', x)
      this.machines = x;
      this.stopped = 0;
      for (var i = 0; i < x.length; i++) {
        if ((x[i] as any).state == "stopped" || (x[i] as any).state == "deleted")
          this.stopped++;
      }
    });


    // http.get(this.SERVER + "/getComputeState").subscribe(x => {
    //   console.log('vms', x);

    //   this.vms = x;
    // });


  }
  ngOnInit(): void {
    this.loadCloudMachines();
    this.loadMachineCatalog();
  }

  onFilterChange(value: string): void {
    this.filterText = value;
    this.applyCloudRegionFilter();
    this.applyCatalogRegionFilter();
  }

  onCloudRegionSelect(index: number): void {
    this.selectedCloudRegionIndex = index;
  }

  onCloudRegionTabChange(index: number): void {
    this.selectedCloudRegionIndex = index;
  }

  setCloudSort(column: CloudMachineSortColumn): void {
    if (this.cloudSortColumn === column) {
      this.cloudSortDirection = this.cloudSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.cloudSortColumn = column;
      this.cloudSortDirection = 'asc';
    }
    this.applyCloudRegionFilter();
  }

  onCatalogRegionSelect(index: number): void {
    this.selectedCatalogRegionIndex = index;
  }

  onCatalogRegionTabChange(index: number): void {
    this.selectedCatalogRegionIndex = index;
  }

  setCatalogSort(column: CatalogSortColumn): void {
    if (this.catalogSortColumn === column) {
      this.catalogSortDirection = this.catalogSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.catalogSortColumn = column;
      this.catalogSortDirection = 'asc';
    }
    this.applyCatalogRegionFilter();
  }

  onCatalogFilterChange(value: string): void {
    this.catalogFilterText = value;
    this.applyCatalogRegionFilter();
  }

  onCatalogShowOnlyPricedChange(checked: boolean): void {
    this.catalogShowOnlyPriced = checked;
    this.applyCatalogRegionFilter();
  }

  loadCloudMachines(): void {
    this.cloudMachinesLoading = true;
    this.cloudMachinesError = null;

    this.http.get<GetMachinesByRegionResponse>(`${this.SERVER}/getMachinesByRegion`)
      .pipe(finalize(() => {
        this.cloudMachinesLoading = false;
      }))
      .subscribe({
        next: (response) => {
          this.cloudRegions = response?.regions ?? [];
          this.totalCloudMachines = response?.total ?? 0;
          this.cloudMachinesLastUpdated = response?.updatedAt ?? null;
          this.applyCloudRegionFilter();
        },
        error: (error) => {
          console.error('Failed to load machines by region', error);
          this.cloudMachinesError = "Unable to load Compute Engine machines. Please try again.";
        }
      });
  }

  formatRegionLabel(region: string | null | undefined): string {
    if (!region) {
      return 'Unknown region';
    }
    return region.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  formatZoneLabel(zone: string | null | undefined): string {
    if (!zone) {
      return 'Unknown zone';
    }
    return zone.toUpperCase();
  }

  formatMachineType(machineType: string | null | undefined): string {
    if (!machineType) {
      return '—';
    }
    return machineType.split('-').map((part, index) => index === 0 ? part.toUpperCase() : part).join('-');
  }

  loadMachineCatalog(): void {
    this.machineCatalogLoading = true;
    this.machineCatalogError = null;

    this.http.get<GetMachineCatalogResponse>(`${this.SERVER}/getMachineCatalog`)
      .pipe(finalize(() => {
        this.machineCatalogLoading = false;
      }))
      .subscribe({
        next: (response) => {
          this.machineCatalogRegions = response?.regions ?? [];
          this.totalMachineCatalog = response?.total ?? 0;
          this.machineCatalogLastUpdated = response?.updatedAt ?? null;
          this.machineCatalogPriceRelease = response?.priceReleaseDate ?? null;
          this.updateCatalogSummary();
          this.applyCatalogRegionFilter();
        },
        error: (error) => {
          console.error('Failed to load machine catalog', error);
          this.machineCatalogError = "Unable to load Google machine catalog. Please try again.";
        }
      });
  }

  formatMemory(memoryGb: number | null | undefined): string {
    if (memoryGb == null) {
      return '—';
    }
    if (memoryGb >= 1) {
      return `${memoryGb.toFixed(1)} GB`;
    }
    return `${(memoryGb * 1024).toFixed(0)} MB`;
  }

  countCatalogForRegion(region: CatalogRegion): number {
    return region?.zones?.reduce((total, zone) => total + (zone?.machineTypes?.length ?? 0), 0) ?? 0;
  }

  countCatalogForZone(zone: CatalogZone): number {
    return zone?.machineTypes?.length ?? 0;
  }

  isDeprecated(machineType: MachineTypeCatalog): boolean {
    return Boolean(machineType.deprecated && machineType.deprecated !== 'SUPPORTED');
  }

  formatPrice(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return `$${value.toFixed(4)}`;
  }

  formatMonthlyPrice(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return `$${value.toFixed(2)}`;
  }

  countMachinesForRegion(region: RegionSummary): number {
    return region?.zones?.reduce((total, zone) => total + (zone?.machines?.length ?? 0), 0) ?? 0;
  }

  countMachinesForZone(zone: ZoneSummary): number {
    return zone?.machines?.length ?? 0;
  }

  private applyCloudRegionFilter(): void {
    const query = this.filterText.trim().toLowerCase();
    if (!this.cloudRegions?.length) {
      this.filteredCloudRegions = [];
      this.selectedCloudRegionIndex = 0;
      return;
    }

    const filtered: RegionSummary[] = [];
    for (const region of this.cloudRegions) {
      const zones: ZoneSummary[] = [];
      for (const zone of region.zones ?? []) {
        const machines = (zone.machines ?? []).filter(machine => this.matchesMachineQuery(machine, zone, region, query));
        if (machines.length) {
          this.sortCloudMachines(machines);
          zones.push({ ...zone, machines });
        }
      }
      if (zones.length) {
        filtered.push({ ...region, zones });
      }
    }

    this.filteredCloudRegions = filtered;
    if (this.selectedCloudRegionIndex >= this.filteredCloudRegions.length) {
      this.selectedCloudRegionIndex = 0;
    }
  }

  private applyCatalogRegionFilter(): void {
    const baseQuery = (this.filterText || '').trim().toLowerCase();
    const localQuery = (this.catalogFilterText || '').trim().toLowerCase();
    const query = [baseQuery, localQuery].filter(Boolean).join(' ').trim();
    if (!this.machineCatalogRegions?.length) {
      this.filteredCatalogRegions = [];
      this.selectedCatalogRegionIndex = 0;
      return;
    }

    const filtered: CatalogRegion[] = [];
    for (const region of this.machineCatalogRegions) {
      const zones: CatalogZone[] = [];
      for (const zone of region.zones ?? []) {
        const machineTypes = (zone.machineTypes ?? []).filter(machine => {
          if (this.catalogShowOnlyPriced && machine.pricePerHourUsd == null) {
            return false;
          }
          return this.matchesCatalogQuery(machine, zone, region, query);
        });
        if (machineTypes.length) {
          this.sortCatalogMachineTypes(machineTypes);
          zones.push({ ...zone, machineTypes });
        }
      }
      if (zones.length) {
        filtered.push({ ...region, zones });
      }
    }

    this.filteredCatalogRegions = filtered;
    if (this.selectedCatalogRegionIndex >= this.filteredCatalogRegions.length) {
      this.selectedCatalogRegionIndex = 0;
    }
  }

  private sortCloudMachines(machines: MachineSummary[]): void {
    const modifier = this.cloudSortDirection === 'asc' ? 1 : -1;
    machines.sort((a, b) => modifier * this.compareCloudMachine(a, b));
  }

  private compareCloudMachine(a: MachineSummary, b: MachineSummary): number {
    let valueA: number | string = '';
    let valueB: number | string = '';
    switch (this.cloudSortColumn) {
      case 'name':
        valueA = (a.name || '').toLowerCase();
        valueB = (b.name || '').toLowerCase();
        break;
      case 'status':
        valueA = (a.status || '').toLowerCase();
        valueB = (b.status || '').toLowerCase();
        break;
      case 'type':
        valueA = (a.machineType || '').toLowerCase();
        valueB = (b.machineType || '').toLowerCase();
        break;
      case 'ip':
        valueA = (a.internalIp || a.externalIp || '').toLowerCase();
        valueB = (b.internalIp || b.externalIp || '').toLowerCase();
        break;
      case 'created':
        valueA = a.creationTimestamp ? new Date(a.creationTimestamp).getTime() : 0;
        valueB = b.creationTimestamp ? new Date(b.creationTimestamp).getTime() : 0;
        break;
    }
    return this.compareValues(valueA, valueB);
  }

  private sortCatalogMachineTypes(machineTypes: MachineTypeCatalog[]): void {
    const direction = this.catalogSortDirection;
    const modifier = direction === 'asc' ? 1 : -1;
    machineTypes.sort((a, b) => modifier * this.compareCatalogMachineType(a, b, direction));
  }

  private compareCatalogMachineType(a: MachineTypeCatalog, b: MachineTypeCatalog, direction: SortDirection): number {
    let valueA: number | string = '';
    let valueB: number | string = '';
    switch (this.catalogSortColumn) {
      case 'name':
        valueA = (a.name || '').toLowerCase();
        valueB = (b.name || '').toLowerCase();
        break;
      case 'vcpu':
        valueA = Number(a.guestCpus ?? 0);
        valueB = Number(b.guestCpus ?? 0);
        break;
      case 'memory':
        valueA = Number(a.memoryGb ?? 0);
        valueB = Number(b.memoryGb ?? 0);
        break;
      case 'hourly':
        valueA = this.normalizeNullableNumber(a.pricePerHourUsd, direction);
        valueB = this.normalizeNullableNumber(b.pricePerHourUsd, direction);
        break;
      case 'monthly':
        valueA = this.normalizeNullableNumber(a.pricePerMonthUsd, direction);
        valueB = this.normalizeNullableNumber(b.pricePerMonthUsd, direction);
        break;
      case 'notes':
        valueA = (a.description || '').toLowerCase();
        valueB = (b.description || '').toLowerCase();
        break;
    }
    return this.compareValues(valueA, valueB);
  }

  private compareValues(valueA: number | string, valueB: number | string): number {
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueA - valueB;
    }
    return String(valueA).localeCompare(String(valueB));
  }

  private normalizeNullableNumber(value: number | null | undefined, direction: SortDirection): number {
    if (value == null) {
      return direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }
    return value;
  }

  private matchesMachineQuery(machine: MachineSummary, zone: ZoneSummary, region: RegionSummary, query: string): boolean {
    if (!query) {
      return true;
    }
    const haystack = [
      machine.name,
      machine.status,
      machine.machineType,
      machine.internalIp,
      machine.externalIp,
      zone.zone,
      region.region
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase())
      .join(' ');
    return haystack.includes(query);
  }

  private matchesCatalogQuery(machineType: MachineTypeCatalog, zone: CatalogZone, region: CatalogRegion, query: string): boolean {
    if (!query) {
      return true;
    }
    const haystack = [
      machineType.name,
      machineType.description,
      machineType.priceSource,
      zone.zone,
      region.region
    ]
      .filter(Boolean)
      .map(value => String(value).toLowerCase())
      .join(' ');
    return haystack.includes(query);
  }

  private updateCatalogSummary(): void {
    const summary: CatalogSummary = {
      totalTypes: 0,
      pricedTypes: 0,
      missingTypes: 0,
      pricedPercentage: 0,
      familyCount: 0,
      pricedFamilies: 0,
      missingFamilies: 0,
      missingFamilySamples: [],
      priceReleaseDate: this.machineCatalogPriceRelease
    };

    const pricedFamilies = new Set<string>();
    const missingFamilies = new Set<string>();

    for (const region of this.machineCatalogRegions ?? []) {
      for (const zone of region.zones ?? []) {
        for (const machineType of zone.machineTypes ?? []) {
          summary.totalTypes += 1;
          const familyKey = this.getFamilyKeyFromMachineName(machineType.name || '');
          if (machineType.pricePerHourUsd != null) {
            summary.pricedTypes += 1;
            if (familyKey) {
              pricedFamilies.add(familyKey);
            }
          } else {
            summary.missingTypes += 1;
            if (familyKey) {
              missingFamilies.add(familyKey);
            }
          }
        }
      }
    }

    summary.familyCount = new Set([...pricedFamilies, ...missingFamilies]).size;
    summary.pricedFamilies = pricedFamilies.size;
    summary.missingFamilies = missingFamilies.size;
    summary.pricedPercentage = summary.totalTypes
      ? Number(((summary.pricedTypes / summary.totalTypes) * 100).toFixed(1))
      : 0;
    summary.missingFamilySamples = Array.from(missingFamilies).slice(0, 10);

    this.catalogSummary = summary;
  }

  private getFamilyKeyFromMachineName(name: string): string | null {
    if (!name) {
      return null;
    }
    const tokens = name.toLowerCase().split('-');
    const familyTokens: string[] = [];
    for (const token of tokens) {
      if (!token) {
        continue;
      }
      if (/^\d/.test(token)) {
        break;
      }
      familyTokens.push(token);
    }
    if (!familyTokens.length && tokens.length) {
      familyTokens.push(tokens[0]);
    }
    return familyTokens.join('') || null;
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

  removevm(id: string) {
    const machineDoc = doc(this.firestore, 'machines', id);
    deleteDoc(machineDoc);
  }




}

interface RegionSummary {
  region: string;
  zones: ZoneSummary[];
}

interface CatalogRegion {
  region: string;
  zones: CatalogZone[];
}

interface ZoneSummary {
  zone: string;
  machines: MachineSummary[];
}

interface CatalogZone {
  zone: string;
  machineTypes: MachineTypeCatalog[];
}

interface MachineSummary {
  id: string | null;
  name: string | null;
  status: string | null;
  zone: string;
  region: string;
  machineType: string | null;
  creationTimestamp: string | null;
  internalIp: string | null;
  externalIp: string | null;
  labels: Record<string, string>;
  tags: string[];
  serviceAccounts: Array<{ email: string | null; scopes: string[]; }>;
}

interface GetMachinesByRegionResponse {
  updatedAt?: string;
  total?: number;
  regions?: RegionSummary[];
}

interface MachineTypeCatalog {
  name: string | null;
  description: string | null;
  guestCpus: number | null;
  memoryMb: number | null;
  memoryGb: number | null;
  maximumPersistentDisks: number | null;
  maximumPersistentDisksSizeGb: string | null;
  deprecated: string | null;
  zone: string;
  region: string;
  selfLink: string | null;
  pricePerHourUsd: number | null;
  pricePerMonthUsd: number | null;
  priceSource: string | null;
}

interface GetMachineCatalogResponse {
  updatedAt?: string;
  total?: number;
  regions?: CatalogRegion[];
  priceReleaseDate?: string;
}

interface CatalogSummary {
  totalTypes: number;
  pricedTypes: number;
  missingTypes: number;
  pricedPercentage: number;
  familyCount: number;
  pricedFamilies: number;
  missingFamilies: number;
  missingFamilySamples: string[];
  priceReleaseDate: string | null;
}

type SortDirection = 'asc' | 'desc';
type CloudMachineSortColumn = 'name' | 'status' | 'type' | 'ip' | 'created';
type CatalogSortColumn = 'name' | 'vcpu' | 'memory' | 'hourly' | 'monthly' | 'notes';



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
