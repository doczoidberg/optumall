import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CustomerComponent } from './customer/customer.component';
import { LoginComponent } from './login/login.component';
import { CustomersComponent as CustomersComponent } from './customers/customers.component';
import { LogsComponent as LogsComponent } from './logs/logs.component';
import { UsageComponent } from './usage/usage.component';
import { SettingsComponent } from './settings/settings.component';
import { TestrunnerComponent } from './testrunner/testrunner.component';
import { VMsComponent } from './vms/vms.component';
import { VMDetailsComponent } from './vmdetails/vmdetails.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminGuard } from './guards/admin.guard';
import { AccountsComponent } from './accounts/accounts.component';
import { AccountUsersComponent } from './account-users/account-users.component';


const routes: Routes = [
  // {
  //   path: "",
  //   component: LoginComponent,
  //   canActivate: [LoggedInGuard]
  // },
  { path: "", redirectTo: "login", pathMatch: "full" },
  // { path: 'home', component: Home },
  // { path: '', component: DashboardComponent },

  { path: "login", component: LoginComponent },

  { path: "dashboard", component: DashboardComponent, canActivate: [AuthGuard] },
  { path: "usage", component: UsageComponent, canActivate: [AuthGuard] },
  // Firestore-based customers routes removed - use /accounts instead
  // { path: "customers", component: CustomersComponent, canActivate: [AuthGuard] },
  // { path: "customer", component: CustomerComponent, canActivate: [AuthGuard] },
  // { path: "customer/:id", component: CustomerComponent, canActivate: [AuthGuard] },
  { path: "logs", component: LogsComponent, canActivate: [AuthGuard] },
  { path: "settings", component: SettingsComponent, canActivate: [AuthGuard] },
  { path: "test", component: TestrunnerComponent, canActivate: [AuthGuard] },
  { path: "vms", component: VMsComponent, canActivate: [AuthGuard] },
  { path: "vms/:id", component: VMDetailsComponent, canActivate: [AuthGuard] },
  { path: "admin/users", component: AdminUsersComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: "accounts", component: AccountsComponent, canActivate: [AuthGuard] },
  { path: "accounts/:id", component: AccountUsersComponent, canActivate: [AuthGuard] },



  // { path: "admin/mitarbeiter", component: UsersComponent, canActivate: [LoggedInGuard] },
  // { path: "admin/kunden", component: CustomersComponent, canActivate: [LoggedInGuard] },

  // { path: "table", component: TableComponent }
];




@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
