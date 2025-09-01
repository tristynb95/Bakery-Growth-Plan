## Running the Application for Verification

This project has been refactored to use Vite for development. To run and verify the application, please follow these steps:

### 1. Install Dependencies

First, you need to install the `npm` packages defined in `package.json`. Run the following command in your terminal:

```bash
npm install
```

### 2. Run the Development Server

Once the dependencies are installed, you can start the Vite development server. This will serve the application on a local port (usually `http://localhost:5173`).

```bash
npm run dev
```

The server will automatically reload when you make changes to the source files in the `src` directory. You can use this to manually test the application's functionality in a web browser.

### 3. Build for Production

To create a production-ready build of the application, run:

```bash
npm run build
```

This will generate a `dist` directory containing the optimized and bundled assets. This is the directory that should be deployed to Netlify.
