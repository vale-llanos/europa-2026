# Guía de Configuración de Autenticación

## 🔒 Seguridad: Solo Admins Pueden Editar

Tu sitio ahora está protegido. Solo los administradores pueden editar contenido (compras, pagos, reservas). Los visitantes pueden ver todo pero no editar.

---

## 📋 Pasos de Configuración

### Paso 1: Ejecutar SQL en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Abre tu proyecto **europa-2026**
3. Ve a **SQL Editor** (esquina izquierda)
4. Crea una nueva query
5. **Copia todo el contenido** de `supabase/auth_setup.sql`
6. **Pégalo** en el SQL Editor
7. **Haz clic en "Run"** (botón verde)

> **⚠️ IMPORTANTE**: Esto va a:
> - Crear tabla `profiles` para tracking de admins
> - Habilitar RLS (Row Level Security) en todas tus tablas
> - Crear políticas de seguridad

**Si hay errores**: No te preocupes si ves errores como `already exists`. Es normal si ya tienes RLS habilitado.

---

### Paso 2: Configurar tu cuenta como Admin

Una vez que ejecutes el SQL:

1. **Abre tu sitio** en el navegador
2. **Haz clic en el botón** � "Sin autenticar" (arriba a la derecha)
3. **En el primer prompt**:
   - Ingresa tu email (ej: `tu-email@gmail.com`)
4. **En el segundo prompt**:
   - Ingresa una contraseña (mínimo 6 caracteres, ejemplo: `Admin123`)
5. **Listo!** Ya estás registrado y con sesión iniciada
6. Pero aún no eres admin...

Ahora tienes que marcar tu cuenta como admin:

1. Ve a Supabase → **SQL Editor**
2. Ejecuta esta query (reemplaza con tu email):

```sql
-- Encontrar tu user ID
SELECT id, email FROM auth.users WHERE email = 'tu-email@gmail.com';
```

3. Copia el `id` que aparece
4. Ejecuta esta query (reemplaza {USER_ID} con el ID que copiaste):

```sql
INSERT INTO public.profiles (id, email, is_admin)
VALUES ('{USER_ID}', 'tu-email@gmail.com', true)
ON CONFLICT (id) DO UPDATE SET is_admin = true;
```

5. **Recarga tu sitio** - Ahora deberías ver 👑 junto a tu email
6. **¡Eres admin!** Puedes editar

---

### Paso 3: Añadir Otros Admins (Opcional)

Repite el **Paso 2** para cada persona que quieras hacer admin.

Para ver todos los admins:

```sql
SELECT id, email, is_admin FROM public.profiles WHERE is_admin = true;
```

---

## 🧪 Probar la Seguridad

### Modo Admin (con tu cuenta)
- Ves botón: 🔒 tu-email@gmail.com 👑
- Edit Mode Status: ✏️ Edit Mode (Admin)
- ✅ Puedes editar, crear, borrar

### Modo Público (sin login)
- Ves botón: 🔓 Sin autenticación
- Edit Mode Status: 👁️ View Mode (Public)
- ❌ No puedes editar (botones deshabilitados)

### Usuario No-Admin
- Si alguien inicia sesión pero no es admin
- Ves: 🔒 email-usuario@gmail.com
- Edit Mode Status: 👁️ View Mode
- ❌ No puede editar

---

## 🔄 Cómo Funciona la Seguridad

### Frontend
1. Tu sitio tiene un botón de login
2. Al hacer clic, envía un "magic link" a tu email
3. Solo los users en la tabla `profiles` con `is_admin=true` pueden editar
4. Si intentas editar sin ser admin, ves: ⛔ "Solo los administradores pueden editar"

### Backend (Supabase)
Las políticas RLS previenen cualquier acceso no autorizado:
- **SELECT**: ✅ Público (todos leen)
- **INSERT/UPDATE/DELETE**: ✅ Solo usuarios autenticados con `is_admin=true`

Si alguien intenta hackear directamente la Supabase API, será rechazado automaticamente.

---

## ⚠️ Cosas Importantes

### Si no ves el botón de auth
- Recarga la página
- Abre la consola (F12 → Console) y busca errores
- Asegúrate de haber ejecutado el SQL correctamente

### Si el magic link no llega
- Revisa la carpeta de SPAM
- Algunos emails son bloqueados - usa Gmail o Outlook si es posible

### Si quiero deshabilitar el login temporalmente
- Elimina la tabla `profiles` en Supabase
- O desactiva RLS momentáneamente:
```sql
ALTER TABLE public.compras DISABLE ROW LEVEL SECURITY;
```

### Migrar datos existentes
Si ya tienes RLS habilitado en algunos tablas, ejecutar el SQL nuevamente puede causar conflictos. En ese caso, primero:

```sql
-- Deshabilitar RLS temporalmente
ALTER TABLE public.compras DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_participantes DISABLE ROW LEVEL SECURITY;
```

Luego ejecuta el SQL completo.

---

## 📞 Troubleshooting

### "Permission denied" al editar
- ✅ Comprueba que tu email esté en `profiles` con `is_admin=true`
- ✅ Recarga la página después de cambiar admin status
- ✅ Revisa que estés logueado (botón debe mostrar tu email con 👑)

### Las políticas RLS no se aplican
- ✅ Verifica que el SQL se ejecutó sin errores
- ✅ Ve a Supabase → "Authentication" → "Policies"
- ✅ Deberías ver ~25 políticas nuevas

### Todos pueden editar (seguridad no funciona)
- ✅ Comprueba RLS está habilitado: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- ✅ Verifica las políticas existen
- ✅ Recarga el sitio completamente (Cmd+Shift+R en Mac)

---

## 🎉 ¡Listo!

Tu sitio está ahora protegido. Solo tú (y otros admins) pueden editar contenido. Los visitantes ven todo pero no pueden cambiar nada.

¿Preguntas? Revisa la consola del navegador (F12) para más detalles de errores.
