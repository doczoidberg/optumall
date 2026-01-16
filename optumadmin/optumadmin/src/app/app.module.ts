import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClient, HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { SharedModule } from './shared.module';
import { AppComponent } from './app.component';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from 'src/environments/environment';

import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';

import { DialogStep, CustomerComponent } from './customer/customer.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UsageComponent, DialogCustomer } from './usage/usage.component';
import { NavComponent } from './nav/nav.component';
import { LogsComponent } from './logs/logs.component';
import { CustomersComponent } from './customers/customers.component';
import { SettingsComponent } from './settings/settings.component';
import { TestrunnerComponent } from './testrunner/testrunner.component';
import { VMsComponent } from './vms/vms.component';
import { VMDetailsComponent } from './vmdetails/vmdetails.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AccountsComponent } from './accounts/accounts.component';
import { AccountUsersComponent } from './account-users/account-users.component';

import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import { AmountPipe } from './amount.pipe';
import { ProjectbyidPipe } from './projectbyid.pipe';

registerLocaleData(localeEn);

@NgModule({
  declarations: [
    AppComponent,
    CustomerComponent,
    LoginComponent,
    DashboardComponent,
    NavComponent,
    DialogStep,
    UsageComponent,
    DialogCustomer,
    CustomersComponent,
    LogsComponent,
    AmountPipe,
    ProjectbyidPipe,
    SettingsComponent,
    VMsComponent,
    VMDetailsComponent,
    TestrunnerComponent,
    AdminUsersComponent,
    AccountsComponent,
    AccountUsersComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    SharedModule,
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    BsDropdownModule.forRoot(),
    BsDatepickerModule.forRoot()
  ],
  providers: [
    { provide: LOCALE_ID, useValue: "en" },
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
