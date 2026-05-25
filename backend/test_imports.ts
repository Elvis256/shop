import { setupHealthChecks, getHealthStatus } from "./src/middleware/monitoring";
import { errorHandler, asyncHandler, Errors } from "./src/middleware/errorHandler";
import { 
  sanitizeString, 
  SafeEmail, 
  validate 
} from "./src/middleware/validation";
import {
  trackLoginAttempt,
  isAccountLocked,
  logSecurityEvent
} from "./src/middleware/securityEvents";

console.log("✅ All imports successful!");
console.log("✅ setupHealthChecks:", typeof setupHealthChecks);
console.log("✅ getHealthStatus:", typeof getHealthStatus);
console.log("✅ errorHandler:", typeof errorHandler);
console.log("✅ asyncHandler:", typeof asyncHandler);
console.log("✅ Errors:", typeof Errors);
console.log("✅ sanitizeString:", typeof sanitizeString);
console.log("✅ SafeEmail:", SafeEmail !== undefined);
console.log("✅ validate:", typeof validate);
console.log("✅ trackLoginAttempt:", typeof trackLoginAttempt);
console.log("✅ isAccountLocked:", typeof isAccountLocked);
console.log("✅ logSecurityEvent:", typeof logSecurityEvent);
