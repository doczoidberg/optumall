import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="unauthorized-container">
      <div class="unauthorized-card">
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <a routerLink="/accounts" class="btn btn-primary">Go to Accounts</a>
      </div>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 20px;
    }

    .unauthorized-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;

      h1 {
        color: #dc3545;
        margin-bottom: 16px;
      }

      p {
        color: #666;
        margin-bottom: 24px;
      }
    }
  `]
})
export class UnauthorizedComponent {}
