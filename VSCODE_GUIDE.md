# نحوه استفاده در VS Code / How to Use in VS Code

## روش 1: باز کردن در پنجره جدید (ایمن‌ترین روش)
## Method 1: Open in New Window (Safest Method)

```
1. پروژه فعلی خود را در VS Code باز نگه دارید
   Keep your current project open in VS Code

2. File → New Window (Ctrl+Shift+N)
   فایل → پنجره جدید

3. در پنجره جدید: File → Open Folder
   In the new window: فایل → باز کردن پوشه
   
4. پوشه cost-gate را انتخاب کنید
   Select the cost-gate folder

5. هر دو پروژه مستقل از هم هستند!
   Both projects are independent!
```

## روش 2: استفاده از Workspace File

```
1. دوبار کلیک روی فایل cost-gate.code-workspace
   Double-click on cost-gate.code-workspace file

2. یا در VS Code: File → Open Workspace from File
   Or in VS Code: فایل → باز کردن ورک‌اسپیس از فایل

3. این روش این پروژه را به صورت مجزا باز می‌کند
   This opens the project separately
```

## روش 3: اضافه کردن به Workspace فعلی (پیشرفته)

```
1. در پروژه فعلی خود: File → Add Folder to Workspace
   In your current project: فایل → افزودن پوشه به ورک‌اسپیس

2. پوشه cost-gate را انتخاب کنید
   Select the cost-gate folder

3. حالا هر دو پروژه در کنار هم هستند
   Now both projects are side by side
```

## اجرا / Running

### از طریق VS Code Debug Panel:
### Through VS Code Debug Panel:

```
1. به تب "Run and Debug" بروید (Ctrl+Shift+D)
   Go to "Run and Debug" tab

2. "Run Cost Gate" را انتخاب کنید
   Select "Run Cost Gate"

3. دکمه سبز Play را بزنید یا F5
   Click green Play button or press F5

4. سرویس در پورت 3005 اجرا می‌شود
   Service runs on port 3005
```

### از طریق Terminal:
### Through Terminal:

```bash
# نصب وابستگی‌ها (فقط یکبار)
# Install dependencies (only once)
npm install

# اجرای سرویس
# Run the service
npm start
```

## تست / Testing

```bash
# روش 1: استفاده از curl
# Method 1: Using curl
curl -X POST http://localhost:3005/run-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"frontend-coder","requestedModel":"gpt-5","prompt":"Test","max_response_tokens":800}'

# روش 2: استفاده از REST Client extension
# Method 2: Using REST Client extension
# فایل run-agent.http را باز کنید و "Send Request" را بزنید
# Open run-agent.http file and click "Send Request"
```

## تضمین ایمنی / Safety Guarantee

✅ این پروژه فقط در پوشه خودش فایل می‌سازد
   This project only creates files in its own folder

✅ تنظیمات VS Code شما تغییر نمی‌کند
   Your VS Code settings don't change

✅ پروژه‌های دیگر شما دست نخورده باقی می‌مانند
   Your other projects remain untouched

✅ فقط روی پورت 3005 گوش می‌دهد
   Only listens on port 3005

✅ node_modules در .gitignore است
   node_modules is in .gitignore
