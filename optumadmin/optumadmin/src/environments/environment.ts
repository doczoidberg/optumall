// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyA4wZyi2dekBD54wo-NMxVy5K8pKnKJ6wU",
    authDomain: "optum-80593.firebaseapp.com",
    projectId: "optum-80593",
    storageBucket: "optum-80593.appspot.com",
    messagingSenderId: "158487002656",
    appId: "1:158487002656:web:c17f48bf5192f19bd34645",
    measurementId: "G-HECM8B7NEG"
  },
  stripe: {
    publishableKey: 'pk_test_51SNbPHJA7hjfzXaRHNf7Wmephedh7kaNsiMiNCasGyNF4PuMM0IEp7pry2MLIembZObeMkEH478P8DhYGvWOfj1m00g55FHJJ9'
  },
  licenseManagementApiUrl: 'http://localhost:8000/api/optumadmin',
  licenseManagementApiKey: 'your-secret-api-key-change-this-in-production'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
