API: User Service
Version: 1.0.0
Server: https://api.example.com
ApiDescription: API untuk register, login, profile, dan upload avatar user.

# Register User
POST /auth/register
Description: Membuat akun user baru memakai email dan password.
Tags: Auth, Users
Flow: Awal auth flow. Setelah berhasil, user dapat login.
Condition:
- Email harus unik.
- Password minimal 8 karakter.
- Nama user wajib diisi.

Headers:
X-Request-Id string optional - ID request untuk tracing.

Body:
name string required minLength=3 maxLength=80 - Nama lengkap user.
email email required - Email unik user.
password string required minLength=8 - Password user.

Success 201:
id string required - ID user.
name string required - Nama lengkap user.
email email required - Email user.
created_at string required format=date-time - Waktu user dibuat.

Error 422:
message string required - Pesan validasi.
errors object required - Detail error per field.

---

# Login User
POST /auth/login
Description: Login user dan mengembalikan access token.
Tags: Auth
DependsOn: Register User
Flow: Dipakai setelah user punya akun aktif.
Condition:
- Email dan password harus cocok.
- Akun blocked tidak boleh login.

Body:
email email required - Email user.
password string required - Password user.

Success 200:
access_token string required - Bearer token untuk auth request berikutnya.
token_type string required enum=Bearer - Jenis token.
expires_in integer required minimum=1 - Masa berlaku token dalam detik.

Error 401:
message string required - Pesan credential salah.

---

# Get Profile
GET /users/me
Description: Mengambil profile user yang sedang login.
Tags: Users
Auth: Bearer token
DependsOn: Login User
Flow: Client memakai access_token dari login.
Condition:
- Token harus valid.
- Token expired menghasilkan 401.

Headers:
Authorization string required - Bearer access token.

Query:
include string optional enum=roles|permissions|avatar - Data tambahan yang ingin disertakan.

Success 200:
id string required - ID user.
name string required - Nama lengkap user.
email email required - Email user.
avatar_url string optional nullable - URL avatar user.

Error 401:
message string required - Token tidak valid atau expired.

---

# Upload Avatar
POST /users/me/avatar
Description: Upload atau mengganti avatar user memakai multipart form-data.
Tags: Users, Media
Auth: Bearer token
DependsOn: Login User, Get Profile
Flow: Setelah profile tersedia, user dapat upload avatar.
Condition:
- File wajib bertipe image.
- Ukuran file maksimal 2MB.
- Avatar lama diganti setelah upload sukses.

Headers:
Authorization string required - Bearer access token.

FormData:
avatar file required maxSize=2MB contentType=image/* - File avatar user.
crop boolean optional - Jika true, server crop gambar menjadi square.

Success 200:
avatar_url string required - URL avatar terbaru.
updated_at string required format=date-time - Waktu avatar diperbarui.

Error 400:
message string required - File tidak valid.

Error 413:
message string required - File terlalu besar.
