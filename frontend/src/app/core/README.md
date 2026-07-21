# Core

Servicios singleton, autenticación, guards, interceptores, configuración y modelos globales.

Estructura inicial:

- `config/`: tokens y configuración transversal.
- `errors/`: errores normalizados del frontend.
- `http/`: cliente HTTP e interceptores globales.
- `models/`: contratos compartidos de transporte y navegación.
- `services/`: estado y servicios singleton transversales.
- `auth/`: sesión y autorización; su implementación real pertenece al módulo de autenticación.
