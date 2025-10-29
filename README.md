# Cost Gate - LLM Model Usage Control

این پروژه یک سرویس کنترل هزینه برای مدل‌های LLM است که می‌تواید به صورت مستقل در VS Code اجرا شود.

This project is a cost-gate service for LLM model usage control that can run independently in VS Code.

## ⚠️ نکته مهم / Important Note

**این پروژه روی پروژه‌های فعلی شما تأثیری ندارد!**  
**This project will NOT affect your existing projects!**

این یک پروژه مستقل است و فقط در این پوشه اجرا می‌شود. شما می‌توانید:
- این پروژه را در یک پنجره جدید VS Code باز کنید
- یا در کنار پروژه فعلی خود به عنوان یک workspace folder اضافه کنید

This is a standalone project that only runs in this folder. You can:
- Open this project in a new VS Code window
- Or add it as a workspace folder alongside your current project

## 🚀 نصب و راه‌اندازی / Installation & Setup

### گام 1: نصب وابستگی‌ها / Step 1: Install Dependencies

```bash
npm install
```

### گام 2: اجرای Override Script (اختیاری) / Step 2: Run Override Script (Optional)

این اسکریپت مدل‌های پرهزینه را با مدل‌های ارزان‌تر جایگزین می‌کند:

```bash
npm run override
```

Or directly:

```bash
node override-models-until.js ./agents-config-safety.json
```

### گام 3: راه‌اندازی سرویس / Step 3: Start the Service

```bash
npm start
```

Or press **F5** in VS Code to start debugging.

## 📋 استفاده در VS Code / VS Code Usage

### روش 1: پنجره جدید (توصیه می‌شود) / Method 1: New Window (Recommended)

1. در VS Code، از منوی File > New Window انتخاب کنید
2. پوشه این پروژه را در پنجره جدید باز کنید
3. پروژه فعلی شما در پنجره قبلی باقی می‌ماند

1. In VS Code, select File > New Window
2. Open this project folder in the new window
3. Your current project remains in the previous window

### روش 2: Multi-root Workspace

1. File > Add Folder to Workspace...
2. این پوشه را انتخاب کنید
3. هر دو پروژه در کنار هم قابل مشاهده خواهند بود

1. File > Add Folder to Workspace...
2. Select this folder
3. Both projects will be visible side by side

## 🎯 استفاده از Launch Configurations

در VS Code، از قسمت Run and Debug می‌توانید:

In VS Code, from the Run and Debug section you can:

1. **Run Cost Gate**: سرویس cost-gate را اجرا کنید
2. **Run override-models-until (once)**: اسکریپت override را یکبار اجرا کنید

## 🧪 تست سرویس / Testing the Service

پس از اجرای سرویس، می‌توانید با استفاده از فایل `run-agent.http` یا curl تست کنید:

After starting the service, you can test using `run-agent.http` file or curl:

```bash
curl -s -X POST http://localhost:3005/run-agent \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "frontend-coder",
    "requestedModel": "gpt-5",
    "prompt": "Test prompt",
    "max_response_tokens": 800,
    "is_premium": true
  }' | jq
```

یا از REST Client extension در VS Code استفاده کنید و فایل `run-agent.http` را باز کنید.

Or use the REST Client extension in VS Code and open `run-agent.http` file.

## 📁 ساختار پروژه / Project Structure

```
.
├── .vscode/              # تنظیمات VS Code / VS Code settings
│   ├── launch.json       # Debug configurations
│   └── tasks.json        # Build tasks
├── agents-config-safety.json  # تنظیمات مدل‌ها / Model configurations
├── orchestrator-cost-gate.js  # سرویس اصلی / Main service
├── override-models-until.js   # اسکریپت override
├── run-agent.http        # نمونه تست / Test examples
├── package.json          # وابستگی‌ها / Dependencies
└── README.md             # این فایل / This file
```

## 🛡️ امنیت / Security

- فایل‌های `node_modules/`, `usage.json`, `approvals.json` و `*.bak.*` در `.gitignore` هستند
- پروژه شما روی سیستم فایل تأثیر نمی‌گذارد
- فقط در پورت 3005 اجرا می‌شود

- Files `node_modules/`, `usage.json`, `approvals.json` and `*.bak.*` are in `.gitignore`
- The project doesn't affect your filesystem
- Only runs on port 3005

## 📚 اطلاعات بیشتر / More Information

برای جزئیات بیشتر، فایل `RUNBOOK.md` را مطالعه کنید.

For more details, read the `RUNBOOK.md` file.
