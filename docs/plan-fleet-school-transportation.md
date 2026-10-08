# Plan — ControlMiles Fleet: School Transportation

Fecha: 2026-10-08 · Estado: propuesta para aprobar

## 1. Qué hay hoy (revisado en el código)

**Tipos de flota (8)** — `src/lib/fleet-profiles.ts` y `fn_valid_fleet_profile` en Supabase:

| Tipo | Módulos opcionales que muestra | Inspección pre-viaje |
|---|---|---|
| Delivery & courier | Routes, Geofences, Owner-operators | Opcional |
| Field service | Routes, Geofences | Opcional |
| Trucking & freight | IFTA, Routes, Geofences, Owner-operators | Obligatoria |
| Construction | IFTA, Routes, Geofences | Obligatoria |
| **Passenger transport** (shuttles, school buses, medical) | Routes, Geofences | Obligatoria |
| Sales & company cars | Geofences | Opcional |
| Driving school | Clases por instructor/vehículo | Opcional |
| Mixed / other | Todo | Obligatoria |

- El tipo se elige una vez en el onboarding y queda bloqueado (`set_fleet_type`; soporte lo cambia con `support_change_fleet_type`).
- Un dueño puede crear 1 flota (más con `multi_org_entitled`).
- El tipo solo decide qué módulos se ven; no cambia permisos ni datos.

**Lo que ya sirve para transporte escolar:**
- Asignación de conductor y vehículo; modos de asignación fija o abierta.
- Turnos (`shifts`, `shift_blocks`) con inicio y fin, ligados a la sesión de GPS.
- Mapa en vivo con la ubicación de cada vehículo (`vehicles.last_*`).
- Geocercas, inspección pre-viaje (DVIR), registro de actividad protegido contra edición e IFTA.

**Lo que falta para transporte escolar:**
- `routes` hoy es solo `origin`/`destination` en texto libre, con conductor, vehículo, fecha y hora. No hay **paradas**, **escuelas**, **estudiantes**, ni la **ejecución diaria** de una ruta (salida, llegada a cada parada, terminada).

## 2. ¿Separar la app gig de fleet?

**Recomendación: no por ahora. Una sola app con pantallas por rol (ya existe), y la web solo para administradores de flota.**

Razones:
- El motor de GPS, los viajes, el odómetro y las inspecciones es el mismo código; dos apps significan dos mantenimientos.
- Cada app nueva en una cuenta personal de Play exige otra prueba cerrada de **12 verificadores × 14 días**, otra ficha de tienda y otras declaraciones de ubicación en segundo plano (con video).
- La app ya separa por rol: el conductor de flota entra por ID y ve `DriverOperationsScreen`, no la pantalla gig.

**Cuándo sí separar** (más adelante): si los distritos piden instalar la app de conductor en tablets administradas (MDM) sin nada de gig, o si las fichas de tienda empiezan a confundir a los clientes. Entonces "ControlMiles Driver" sería una segunda app con el mismo código (otro *flavor* de Flutter).

## 3. Investigación — cómo lo resuelve la competencia

| Producto | Para quién | Cómo funciona | Precio público |
|---|---|---|---|
| Transfinder (Routefinder, Wayfinder, Stopfinder) | Distritos medianos y grandes | Planeación de rutas, app de conductor (Wayfinder), app de padres (Stopfinder), GPS de terceros (Zonar) | Por cotización, por estudiante al año |
| Zonar (Bus Suite, Z Pass) | Distritos y contratistas | GPS con equipo instalado; tarjeta RFID del estudiante al subir y bajar; app de padres; check-in manual en la app del conductor si falta la tarjeta | Por cotización + hardware |
| Here Comes the Bus (Synovia/CalAmp) | Distritos | App de padres con la ubicación GPS del bus; lectura de tarjetas opcional | Por cotización |
| Samsara K-12 | Distritos y contratistas | GPS con equipo instalado, sensores (paleta de alto), ETA por parada mediante apps de terceros (BusWhere, SafeStop) | Por cotización + hardware |
| BusBoss (DISTRICTpatrol, JourneyPatrol) | Contratistas y distritos pequeños | Facturación a distritos por ruta y millaje, excursiones, registros del conductor | Por usuario |
| busHive | Contratistas | Programación y facturación de excursiones y actividades; tarifas por distrito y año escolar | — |
| UniteGPS | Distritos y contratistas | Rutas $49/mes, GPS $25/bus/mes, tablet $39/bus/mes, equipo ≈ $1,849/bus | Público |
| School Bus Manager | Operadores pequeños | Rutas web | $99–$599/mes |
| HopSkipDrive, Zum, EverDriven | Distritos (rutas que no cubre el bus) | Red de conductores tipo rideshare con app propia | Contrato por viaje |

**Lo que se repite en el mercado:**
1. **Ruta = lista ordenada de paradas** con hora programada, ejecutada por día ("run" de mañana o de tarde).
2. **Control de quién sube y quién baja**: tarjeta RFID, código QR o lista en la tablet del conductor. Siempre hay una opción manual.
3. **Panel en vivo**: buses en el mapa, estado de cada ruta (no iniciada, en curso, atrasada, terminada) y ETA de la próxima parada.
4. **App o enlace para padres** con la ubicación y el ETA de *su* parada, que el distrito activa y controla.
5. **Facturación al distrito** por ruta y millaje (millas con estudiantes vs millas vacías), más excursiones.
6. **Privacidad de estudiantes (FERPA y leyes estatales)**: las rutas y listas de pasajeros se tratan como registros educativos. El proveedor actúa como "school official" con contrato: acceso por rol, sin compartir datos y borrado al terminar el contrato.

**Hueco que puede ocupar ControlMiles:** casi todos exigen **hardware instalado** (GPS de $1,800+ por bus o lectores RFID) y venden a distritos grandes con cotización y meses de implementación. Un **contratista pequeño** (5–40 buses o vans que da servicio a una ciudad o condado) puede empezar con **el teléfono o una tablet del conductor**, precio público por bus y configuración propia en un día, con la facturación al distrito incluida.

## 4. Diseño propuesto — "School transportation"

### 4.1 Onboarding
- Nuevo tipo de flota **`school_transport` — "School transportation"**: rutas escolares, paradas, estudiantes, geocercas e inspección pre-viaje obligatoria.
- "Passenger transport" se queda para shuttles y transporte médico. Las flotas que ya existen como Passenger y sean escolares se pasan con `support_change_fleet_type`.

### 4.2 Datos (Supabase, todo con RLS por organización)
| Tabla | Para qué |
|---|---|
| `school_sites` | Escuelas y campus: nombre, dirección, lat/lng, horario de entrada y salida, distrito o cliente |
| `route_stops` | Paradas ordenadas de una ruta: secuencia, lat/lng, radio, hora programada; tipo `pickup` / `school` / `dropoff` |
| `students` | Datos mínimos: nombre (o nombre e inicial), grado, escuela, ID externo del distrito, notas de necesidades especiales; contacto del tutor opcional |
| `student_stop_assignments` | Qué estudiante sube o baja en qué parada y en qué ruta (AM/PM) |
| `route_runs` | La ejecución de una ruta en un día: conductor, vehículo, `shift_block`, sesión GPS, inicio y fin, estado |
| `route_stop_events` | Llegada y salida reales de cada parada (automáticas por geocerca) |
| `ridership_events` | Estudiante subió o bajó: hora, lugar, método (manual / QR) |

- Se reutilizan `routes` (agregando `route_type`: `school_am`, `school_pm`, `field_trip`, `general`, y `school_site_id`), `shift_blocks`, `sessions`, `vehicles` y el registro de actividad protegido.

### 4.3 App del conductor (Flutter, misma app, rol conductor de flota)
1. **Inspección pre-viaje** (ya existe).
2. **Iniciar ruta** = inicia el turno y la sesión GPS (ya existe) + crea el `route_run`.
3. **Lista de paradas en orden**: la llegada se marca sola al entrar en el radio de la parada; botón manual de respaldo.
4. **Subida y bajada de estudiantes**: lista de la parada con un toque por estudiante; QR en la fase 3.
5. **Terminar ruta** cuando la última parada se completa.
6. **Revisión final del bus ("child check")**: confirmación obligatoria de que no queda ningún niño a bordo, con hora y lugar. Muchos estados la exigen.

### 4.4 Panel web del administrador (school)
- **Mapa en vivo** de todos los buses con color por estado de la ruta: no iniciada, en curso, atrasada, terminada.
- Por bus: conductor, ruta, próxima parada con ETA, estudiantes a bordo, minutos de atraso.
- **Alertas**: ruta no iniciada a su hora, bus fuera de ruta, parada omitida, estudiante que subió y no bajó, revisión final sin hacer.
- **Planeación**: escuelas, paradas en el mapa (arrastrar para ordenar), asignar estudiantes a paradas e importar desde CSV del distrito.
- **Reportes para cobrar al distrito**: por ruta y día, millas con estudiantes vs millas vacías, horas, puntualidad y ocupación; CSV y PDF.
- **Excursiones** (`field_trip`) con solicitud, asignación y factura (fase 3).

### 4.5 Padres (fase 3, opcional)
- Enlace sin cuenta (con token, como el Report Portal) que muestra **solo** el bus y el ETA de la parada de su hijo. Lo activa el contratista o el distrito. Sin app nueva.

## 5. Privacidad y contratos
- Datos mínimos del estudiante; nada de dirección de casa si basta la parada.
- Acceso por rol: administrador, despachador y conductor (el conductor ve solo su ruta del día).
- Registro de actividad de quién vio o editó datos de estudiantes (ya existe la base).
- Borrado de datos al terminar el contrato y exportación para el distrito.
- **Plantilla de acuerdo de datos (DPA)** para firmar con cada distrito: ControlMiles como "school official" según FERPA, sin vender ni compartir datos, aviso de brechas y subprocesadores (Supabase, Vercel). Revisar con un abogado las leyes del estado de cada cliente.
- La app no está dirigida a niños y los niños no la usan: solo el conductor y el administrador.

## 6. Precio sugerido
- **School**: $24.99–$29.99 por bus al mes, sin equipo (teléfono o tablet del conductor). Referencia: UniteGPS cobra $25 de GPS + $39 de tablet por bus, más ≈ $1,800 de equipo.
- Prueba de 15 días, igual que las demás flotas. Facturación con Stripe (pendiente de la cuenta definitiva).

## 7. Fases
| Fase | Contenido | Estimado |
|---|---|---|
| 0 | Tipo `school_transport` en el onboarding, módulos visibles, tablas base y RLS | 1 semana |
| 1 (MVP) | Escuelas, paradas ordenadas, rutas AM/PM, ejecución de la ruta desde la app, llegada automática a paradas, mapa en vivo con estado de ruta, terminar ruta | 3–4 semanas |
| 2 | Estudiantes y asignación a paradas (con CSV), subida y bajada manual, revisión final del bus, alertas, reporte de facturación al distrito | 3 semanas |
| 3 | Enlace para padres con ETA, pases QR, excursiones con factura, optimización de rutas | 4+ semanas |

**Primer paso propuesto:** validar la fase 1 con 1 o 2 contratistas reales (5–20 buses) antes de construir estudiantes y padres.

## Fuentes
- [UniteGPS — precios](https://unitegps.com/pricing) · [Comparación de software escolar](https://unitegps.com/feeds/blog/school-transportation-software-comparison)
- [Civic IQ — precios de software de transporte escolar 2026](https://civiciq.com/blog/school-transportation-software-2026-pricing-vendors-k-12-contract-analysis)
- [School Bus Manager — Capterra](https://www.capterra.com/p/178415/School-Bus-Manager/)
- [Zonar Z Pass](https://www.zonar.com/solutions/z-pass-student-tracking/) · [Zonar Bus Suite](https://www.zonar.com/solutions/bus-suite/)
- [Here Comes the Bus — FAQ](https://herecomesthebus.com/faq/) · [Stopfinder (Transfinder)](https://www.transfinder.com/solutions/Stopfinder)
- [School Bus Fleet — apps de seguimiento de pasajeros](https://www.schoolbusfleet.com/articles/rider-tracking-apps-ensure-safety-transparency-peace-of-mind)
- [Samsara K-12](https://samsara.com/industries/k-12) · [BusWhere en Samsara](https://samsara.com/resources/marketplace/buswhere)
- [BusBoss DISTRICTpatrol](https://www.busboss.com/districtpatrol) · [JourneyPatrol](https://www.busboss.com/journey-patrol) · [BusBoss — FERPA](https://www.busboss.com/ferpa-compliant-transportation-software)
- [Transfinder — privacidad de estudiantes](https://www.transfinder.com/resources/how-to-protect-student-privacy-during-transit-in-2025)
- [HopSkipDrive 2026–2027](https://stnonline.com/industry-releases/hopskipdrive-brings-free-ride-recording-and-consistent-caredriver-program-to-2026-2027-school-year/)
