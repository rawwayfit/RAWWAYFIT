# RAWWAYFIT | Personal Training & Online Coaching

**Transform Your Body. Elevate Your Life.**

RAWWAYFIT is a personal fitness training and online coaching platform created by **Rakesh H V**, a certified personal trainer with over 7 years of experience in the fitness industry.

The project brings together the RAWWAYFIT fitness website, client fitness assessment system, trainer dashboard, and feedback management tools.

🌐 **Website:** [RAWWAYFIT](https://rawwayfit.in)  
💻 **GitHub Repository:** [rawwayfit/RAWWAYFIT](https://github.com/rawwayfit/RAWWAYFIT)  
📧 **Contact:** rawwayfit@gmail.com

---

## 📌 About the Project

RAWWAYFIT is designed to help individuals improve their fitness through personalized training, sustainable lifestyle changes, and structured coaching.

The website also provides tools to support the trainer's workflow, including client assessment submissions, trainer-side assessment management, and client feedback.

## ✨ Features

### 🌐 Fitness Website
- Personal trainer profile and professional introduction
- Fitness services and coaching information
- Certifications and athletic journey
- Before-and-after and fitness progress sections
- Client feedback and contact options
- Responsive layout for desktop and mobile devices

### 📝 Client Fitness Assessment
- Online fitness assessment form
- Collection of client goals, measurements, lifestyle information, nutrition preferences, and training history
- Submission of assessment data to Supabase
- Client assessment reference numbers
- Duplicate email submission prevention, as implemented in the backend

### 🏋️ Trainer Dashboard
- Secure trainer sign-in through Supabase Auth
- View submitted client assessments
- Search and filter client records
- Review client fitness and health information
- Manage training status and next review dates
- Save trainer notes and initial training plans
- Delete assessment records when necessary

### 💬 Feedback Management
- Feedback submission and storage
- Trainer-side feedback administration
- Review and approval workflow, where configured

## 🛠️ Technologies Used

- **HTML5** — page structure
- **CSS3** — styling and responsive layouts
- **JavaScript** — website and dashboard interactions
- **Supabase** — database, authentication, and backend functions
- **PostgreSQL** — relational data storage
- **Git and GitHub** — source control and project hosting
- **Cloudflare** — website hosting and deployment, if configured for the project

## 📂 Project Structure

```text
RAWWAYFIT/
├── index.html
├── style.css
├── script.js
├── rawwayfit-app.css
├── rawwayfit-header.css
├── rawwayfit-theme.css
├── rawwayfit-config.js
├── supabase-config.js
├── assessment.html
├── assessment.js
├── trainer.html
├── trainer.js
├── feedback-admin.html
├── supabase-schema.sql
├── SUPABASE-SETUP.sql
└── supabase/
    └── functions/
        └── submit-assessment/
            └── index.ts
```

*This is a guide to the main project files. The actual repository may contain additional files or a slightly different structure.*

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rawwayfit/RAWWAYFIT.git
cd RAWWAYFIT
```

### 2. Open the project

Open the folder in Visual Studio Code or GitHub Codespaces.

You can run the static website using a local development server, such as the VS Code Live Server extension.

### 3. Configure Supabase

Create or use a Supabase project and configure the required project URL and publishable key in the appropriate configuration file.

Check the project configuration before running the assessment form or trainer dashboard.

### 4. Configure the database

Review the SQL setup files before running them in the Supabase SQL Editor.

Make sure the required tables, permissions, Row Level Security (RLS) policies, and database functions are configured for the features you intend to use.

### 5. Configure backend functions

Review the functions in `supabase/functions/` and deploy the required Edge Functions using the Supabase CLI when applicable.

Follow the official [Supabase Edge Functions documentation](https://supabase.com/docs/guides/functions).

### 6. Deploy the website

Deploy the static website through your configured hosting provider. If Cloudflare Pages is connected to the GitHub repository, verify the build settings and deployment status after pushing changes.

## 🔐 Security and Privacy

This repository is public. Please follow these security practices:

- Never commit Supabase secret keys, service-role keys, passwords, or private tokens.
- Use only the appropriate publishable key in browser-side code.
- Keep secret keys in secure backend environment variables or the hosting provider's secrets manager.
- Configure and test Row Level Security policies before exposing database operations.
- Restrict trainer-only actions to authorized users.
- Avoid publishing client names, contact details, health information, assessment responses, or other private records.
- Do not place real client assessment data in screenshots, examples, or documentation.

**Important:** A public Supabase publishable key is not a substitute for database security. Access must still be controlled through correct database permissions and RLS policies.

## 👤 About the Trainer

**Rakesh H V — Certified Personal Trainer**

Rakesh has over 7 years of experience in the fitness industry and a background in district-level sprint athletics and state-level cycling competition.

### Certifications
- Certified Personal Trainer — Proton Fitness Academy (2024)
- Certified Nutrition Coach — Proton Fitness Academy, ACE Approved (2024)
- CPR/AED Certification — Proton Fitness Academy (verify current validity before displaying as active)

### Areas of Expertise
- Weight loss and fat loss
- Muscle gain and strength training
- Body recomposition
- Functional fitness
- Sports performance training
- Personalized nutrition planning
- Lifestyle and habit transformation

## 📬 Contact

**RAWWAYFIT — Personal Training & Online Coaching**

- Email: [rawwayfit@gmail.com](mailto:rawwayfit@gmail.com)
- Website: [https://rawwayfit.in](https://rawwayfit.in)
- GitHub: [https://github.com/rawwayfit/RAWWAYFIT](https://github.com/rawwayfit/RAWWAYFIT)

For coaching inquiries, please use the contact options available on the website.

## 📄 License

Unless a license is explicitly added to this repository, all rights are reserved by the repository owner. Public visibility on GitHub does not automatically grant permission to copy, redistribute, or commercially reuse the project's code, branding, images, or content.

---

**RAWWAYFIT — Transform Your Body. Elevate Your Life.**
