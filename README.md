# Padel Galaxy

App para gestionar pozos de pádel (americano/mexicano) en celular y desktop. Construida con **Next.js 16**, **TypeScript**, **Tailwind v4** y **shadcn/ui**. Persistencia en `localStorage`.

## Funcionalidades

- **Login con shadcn `login-02`** y credenciales por env (`AUTH_EMAIL`, `AUTH_PASSWORD`, `AUTH_SECRET`). Cookie HMAC firmada + Proxy de Next 16 que protege todas las rutas.
- **Crear pozo** con: cantidad de canchas, jugadores, partidos por jugador (default = `N - 1`), duración total, calentamiento, cálculo automático del tiempo por partido, algoritmo de emparejamiento y opción de repetir parejas.
- **Tres algoritmos**: `balanced` (los que ganan vs los que ganan, equipos del mismo nivel), `random` (al azar), `snake` (el más fuerte con el más débil).
- **Anti-repetición**: el algoritmo evita emparejar la misma pareja si está apagado el switch.
- **Cronómetro grande**: calentamiento y tiempo total en cuenta regresiva.
- **Resultados por ronda**: cargás games por equipo y el siguiente partido se arma con los resultados actuales.
- **Podio** + tabla de posiciones (PG, GF, GC, DIF, Pts) al finalizar.
- **Dark mode** con `next-themes`, mobile-first.

## Desarrollo

```bash
npm install
npm run dev
```

Las credenciales por defecto están en `.env.local`:

```
AUTH_EMAIL=test@test.com
AUTH_PASSWORD=test1234
AUTH_SECRET=padel-galaxy-local-dev-secret
```

## Estructura

```
src/
├── app/
│   ├── (app)/pozos/...   Rutas autenticadas
│   ├── api/auth/...      Login / logout
│   ├── login/            Login con login-02
│   └── icon.svg          Favicon
├── components/
│   ├── pozo/             Componentes de dominio (PozoView, MatchCard, Podium, ...)
│   └── ui/               shadcn/ui
├── hooks/
│   ├── use-pozos.ts      useSyncExternalStore sobre localStorage
│   └── use-now.ts        Reloj 1s para el cronómetro
├── lib/
│   ├── pozo/             Tipos, algoritmos, tabla, factory
│   ├── auth.ts           HMAC + verificación
│   └── storage.ts        Adaptador de localStorage
└── proxy.ts              Auth middleware (Next 16 "proxy")
```

## Notas

- La base de datos es local (`localStorage`). Las acciones disparan eventos `padel-galaxy:pozos-updated` para sincronizar entre tabs y componentes.
- El algoritmo "balanced" usa una asignación tipo snake-draft por skill (wins + games_diff) y luego elige la mejor combinación de equipos minimizando: parejas repetidas, oponentes repetidos y diferencia de skill.
- El "snake" prioriza poner al mejor con el peor en el mismo equipo.
- Reemplazá `public/login-bg.svg` y `src/app/icon.svg` por tus assets reales si querés tus propias imágenes.
