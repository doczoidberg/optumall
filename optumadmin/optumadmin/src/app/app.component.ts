import { Component, OnDestroy, Renderer2 } from '@angular/core';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminUsersService } from './services/admin-users.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'OptumAdmin';

  events: string[] = [];
  opened = false; // sidenav
  shouldRun = true;
  toggle = true;

  user: any;
  role: string | null = null;
  isAdmin = false;
  private readonly subscriptions = new Subscription();
  //   constructor( ) {
  constructor(
    public auth: Auth,
    public router: Router,
    public route: ActivatedRoute,
    public renderer: Renderer2,
    private readonly adminUsersService: AdminUsersService
  ) {
    console.log("route ", this.route);
    //  let id = this.route.snapshot.paramMap.get("id");
    this.subscriptions.add(
      authState(this.auth).subscribe(user => {
        this.user = user;
        console.log('user', this.user);
      })
    );

    this.subscriptions.add(
      this.adminUsersService.role$.subscribe(role => {
        if (role === undefined) {
          return;
        }
        this.role = role;
        this.isAdmin = role === 'admin';
      })
    );

  }

  async ngOnInit() {

    // this.user = await this.afAuth.currentUser;
    // console.log('user', this.user);
  }

  public toggleTheme() {
    if (this.toggle) {
      this.renderer.addClass(document.body, "unicorn-dark-theme");
    } else {
      this.renderer.removeClass(document.body, "unicorn-dark-theme");
    }
    this.toggle = !this.toggle;
  }

  logout() {
    signOut(this.auth).then(() => {
      this.router.navigate(['/login']);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
