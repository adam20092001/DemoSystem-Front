import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  template: `
    <main class="login">
      <section class="promo">
        <a class="brand" href="#">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </span>
          <span>IMDIMAQ</span>
        </a>
        <div class="promo-body">
          <p class="eyebrow">Sistema interno de gestión comercial</p>
          <h1>Maquinaria, repuestos y equipos<br><em>bajo un solo control.</em></h1>
          <p class="lead">Catálogo técnico, cotizaciones, ventas e inventario trazable conectados para que tu equipo opere con precisión.</p>
        </div>
        <ul class="promo-stats">
          <li><strong>10</strong><span>módulos operativos</span></li>
          <li><strong>4</strong><span>roles de trabajo</span></li>
          <li><strong>S/</strong><span>moneda única · IGV 18%</span></li>
        </ul>
      </section>

      <section class="access">
        <form (ngSubmit)="$event.preventDefault()">
          <p class="eyebrow">Acceso interno</p>
          <h2>Ingresa a tu cuenta</h2>
          <p class="sub">Usa tus credenciales corporativas para continuar.</p>

          <label class="field">
            <span>Usuario o correo</span>
            <input class="input" value="admin" autocomplete="username">
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input class="input" type="password" value="demoadmin" autocomplete="current-password">
          </label>

          <button class="btn btn--primary submit" routerLink="/dashboard" type="button">
            Ingresar al sistema
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>

          <p class="hint">Entorno de demostración — cualquier credencial permite continuar.</p>
        </form>
      </section>
    </main>
  `,
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {}
