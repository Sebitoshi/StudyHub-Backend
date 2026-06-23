export enum ProfessionalLevel {
  STUDENT = 'STUDENT',
  INTERN = 'INTERN',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
}

export enum Modality {
  ON_SITE = 'ON_SITE',
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
}

export enum Availability {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  FREELANCE = 'FREELANCE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

export enum SkillLevel {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum AccessActionType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  TWO_FA_ENABLE = 'TWO_FA_ENABLE',
  TWO_FA_DISABLE = 'TWO_FA_DISABLE',
}

export enum VerificationTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_CHANGE = 'EMAIL_CHANGE',
  TWO_FA = 'TWO_FA',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}
