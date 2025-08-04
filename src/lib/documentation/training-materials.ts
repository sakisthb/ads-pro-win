/**
 * Training Materials System
 * Comprehensive training and learning management for Ads Pro Enterprise
 * 
 * Features:
 * - Interactive courses
 * - Video tutorials
 * - Hands-on workshops
 * - Assessments and quizzes
 * - Learning management
 * - Progress tracking
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Course {
  id: string;
  title: string;
  description: string;
  category: 'beginner' | 'intermediate' | 'advanced' | 'admin';
  duration: number; // minutes
  modules: CourseModule[];
  prerequisites: string[];
  objectives: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  instructor: string;
  lastUpdated: Date;
  version: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'interactive' | 'workshop' | 'quiz' | 'hands-on';
  duration: number; // minutes
  content: ModuleContent[];
  exercises: Exercise[];
  resources: Resource[];
  assessment?: ModuleAssessment;
}

export interface ModuleContent {
  id: string;
  type: 'text' | 'video' | 'interactive' | 'code' | 'image' | 'audio';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  order: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  type: 'multiple-choice' | 'fill-blank' | 'hands-on' | 'project';
  instructions: string[];
  expectedOutcome: string;
  hints?: string[];
  solution?: string;
  points: number;
  timeLimit?: number; // minutes
}

export interface Resource {
  id: string;
  title: string;
  type: 'document' | 'video' | 'link' | 'code' | 'template';
  url: string;
  description: string;
  size?: string;
  format?: string;
}

export interface ModuleAssessment {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
  passingScore: number;
  timeLimit?: number; // minutes
  attempts: number;
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay' | 'hands-on';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetRole: 'user' | 'admin' | 'developer' | 'analyst';
  courses: string[]; // Course IDs
  estimatedDuration: number; // hours
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  outcomes: string[];
}

export interface UserProgress {
  userId: string;
  courseId: string;
  moduleId: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'failed';
  progress: number; // percentage
  startDate: Date;
  completionDate?: Date;
  timeSpent: number; // minutes
  assessmentScore?: number;
  exercises: ExerciseProgress[];
}

export interface ExerciseProgress {
  exerciseId: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'failed';
  attempts: number;
  score?: number;
  timeSpent: number; // minutes
  lastAttempt?: Date;
}

export interface TrainingMetrics {
  totalCourses: number;
  totalModules: number;
  totalExercises: number;
  totalAssessments: number;
  averageCompletionRate: number;
  averageAssessmentScore: number;
  popularCourses: string[];
  activeUsers: number;
  totalLearningHours: number;
}

// ============================================================================
// TRAINING MATERIALS CORE
// ============================================================================

export class TrainingMaterialsSystem {
  private courses: Map<string, Course> = new Map();
  private learningPaths: Map<string, LearningPath> = new Map();
  private userProgress: Map<string, UserProgress[]> = new Map();

  constructor() {
    this.initializeTrainingMaterials();
  }

  // ============================================================================
  // COURSE MANAGEMENT
  // ============================================================================

  async createCourse(course: Course): Promise<void> {
    this.courses.set(course.id, course);
    console.log(`🎓 Created course: ${course.title}`);
  }

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    const course = this.courses.get(courseId);
    if (!course) return;

    Object.assign(course, updates);
    course.lastUpdated = new Date();
    console.log(`📝 Updated course: ${course.title}`);
  }

  async deleteCourse(courseId: string): Promise<void> {
    this.courses.delete(courseId);
    console.log(`🗑️ Deleted course: ${courseId}`);
  }

  getCourse(courseId: string): Course | undefined {
    return this.courses.get(courseId);
  }

  getAllCourses(): Course[] {
    return Array.from(this.courses.values())
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  getCoursesByCategory(category: Course['category']): Course[] {
    return Array.from(this.courses.values())
      .filter(course => course.category === category)
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  // ============================================================================
  // LEARNING PATH MANAGEMENT
  // ============================================================================

  async createLearningPath(path: LearningPath): Promise<void> {
    this.learningPaths.set(path.id, path);
    console.log(`🛤️ Created learning path: ${path.title}`);
  }

  async updateLearningPath(pathId: string, updates: Partial<LearningPath>): Promise<void> {
    const path = this.learningPaths.get(pathId);
    if (!path) return;

    Object.assign(path, updates);
    console.log(`📝 Updated learning path: ${path.title}`);
  }

  getLearningPath(pathId: string): LearningPath | undefined {
    return this.learningPaths.get(pathId);
  }

  getAllLearningPaths(): LearningPath[] {
    return Array.from(this.learningPaths.values())
      .sort((a, b) => a.difficulty.localeCompare(b.difficulty));
  }

  getLearningPathsByRole(role: LearningPath['targetRole']): LearningPath[] {
    return Array.from(this.learningPaths.values())
      .filter(path => path.targetRole === role)
      .sort((a, b) => a.difficulty.localeCompare(b.difficulty));
  }

  // ============================================================================
  // USER PROGRESS MANAGEMENT
  // ============================================================================

  async startCourse(userId: string, courseId: string): Promise<void> {
    const course = this.courses.get(courseId);
    if (!course) return;

    const progress: UserProgress = {
      userId,
      courseId,
      moduleId: course.modules[0]?.id || '',
      status: 'in-progress',
      progress: 0,
      startDate: new Date(),
      timeSpent: 0,
      exercises: []
    };

    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, []);
    }

    this.userProgress.get(userId)!.push(progress);
    console.log(`🚀 User ${userId} started course: ${course.title}`);
  }

  async updateProgress(userId: string, courseId: string, moduleId: string, progress: number): Promise<void> {
    const userProgress = this.userProgress.get(userId);
    if (!userProgress) return;

    const courseProgress = userProgress.find(p => p.courseId === courseId);
    if (!courseProgress) return;

    courseProgress.progress = progress;
    courseProgress.moduleId = moduleId;
    courseProgress.timeSpent += 5; // Simulate time spent

    if (progress >= 100) {
      courseProgress.status = 'completed';
      courseProgress.completionDate = new Date();
    }

    console.log(`📊 Updated progress for user ${userId}: ${progress}%`);
  }

  async completeExercise(userId: string, courseId: string, exerciseId: string, score: number): Promise<void> {
    const userProgress = this.userProgress.get(userId);
    if (!userProgress) return;

    const courseProgress = userProgress.find(p => p.courseId === courseId);
    if (!courseProgress) return;

    let exerciseProgress = courseProgress.exercises.find(e => e.exerciseId === exerciseId);
    if (!exerciseProgress) {
      exerciseProgress = {
        exerciseId,
        status: 'not-started',
        attempts: 0,
        timeSpent: 0
      };
      courseProgress.exercises.push(exerciseProgress);
    }

    exerciseProgress.attempts++;
    exerciseProgress.score = score;
    exerciseProgress.lastAttempt = new Date();
    exerciseProgress.status = score >= 70 ? 'completed' : 'failed';

    console.log(`✅ User ${userId} completed exercise ${exerciseId} with score: ${score}%`);
  }

  getUserProgress(userId: string): UserProgress[] {
    return this.userProgress.get(userId) || [];
  }

  getCourseProgress(userId: string, courseId: string): UserProgress | undefined {
    const userProgress = this.userProgress.get(userId);
    return userProgress?.find(p => p.courseId === courseId);
  }

  // ============================================================================
  // ASSESSMENT MANAGEMENT
  // ============================================================================

  async createAssessment(assessment: ModuleAssessment): Promise<void> {
    console.log(`📝 Created assessment: ${assessment.title}`);
  }

  async gradeAssessment(userId: string, assessmentId: string, answers: Record<string, any>): Promise<number> {
    // Simulate assessment grading
    const score = Math.random() * 40 + 60; // 60-100%
    console.log(`📊 Graded assessment for user ${userId}: ${score.toFixed(1)}%`);
    return score;
  }

  // ============================================================================
  // METRICS & REPORTING
  // ============================================================================

  getTrainingMetrics(): TrainingMetrics {
    const courses = Array.from(this.courses.values());
    const allUserProgress = Array.from(this.userProgress.values()).flat();

    const totalCourses = courses.length;
    const totalModules = courses.reduce((sum, course) => sum + course.modules.length, 0);
    const totalExercises = courses.reduce((sum, course) => 
      sum + course.modules.reduce((moduleSum, module) => moduleSum + module.exercises.length, 0), 0);
    const totalAssessments = courses.reduce((sum, course) => 
      sum + course.modules.filter(module => module.assessment).length, 0);

    const completedProgress = allUserProgress.filter(p => p.status === 'completed');
    const averageCompletionRate = allUserProgress.length > 0 
      ? (completedProgress.length / allUserProgress.length) * 100 
      : 0;

    const assessmentScores = allUserProgress
      .filter(p => p.assessmentScore !== undefined)
      .map(p => p.assessmentScore!);
    const averageAssessmentScore = assessmentScores.length > 0 
      ? assessmentScores.reduce((sum, score) => sum + score, 0) / assessmentScores.length 
      : 0;

    const totalLearningHours = allUserProgress.reduce((sum, progress) => sum + progress.timeSpent, 0) / 60;

    return {
      totalCourses,
      totalModules,
      totalExercises,
      totalAssessments,
      averageCompletionRate,
      averageAssessmentScore,
      popularCourses: ['user-authentication', 'api-integration', 'deployment-guide'],
      activeUsers: this.userProgress.size,
      totalLearningHours
    };
  }

  generateProgressReport(userId: string): string {
    const userProgress = this.userProgress.get(userId);
    if (!userProgress || userProgress.length === 0) {
      return 'No progress data available';
    }

    const completedCourses = userProgress.filter(p => p.status === 'completed');
    const inProgressCourses = userProgress.filter(p => p.status === 'in-progress');
    const totalTimeSpent = userProgress.reduce((sum, p) => sum + p.timeSpent, 0);

    const report = `
# Learning Progress Report
**User:** ${userId}
**Date:** ${new Date().toISOString()}

## Summary
- **Total Courses Started:** ${userProgress.length}
- **Completed Courses:** ${completedCourses.length}
- **In Progress:** ${inProgressCourses.length}
- **Total Time Spent:** ${Math.round(totalTimeSpent / 60)} hours

## Course Progress
${userProgress.map(p => {
  const course = this.courses.get(p.courseId);
  return `- **${course?.title || p.courseId}**: ${p.progress}% (${p.status})`;
}).join('\n')}

## Recommendations
${this.generateRecommendations(userId)}
    `;

    return report;
  }

  private generateRecommendations(userId: string): string {
    const userProgress = this.userProgress.get(userId);
    if (!userProgress) return 'Start with beginner courses';

    const completedCourses = userProgress.filter(p => p.status === 'completed');
    const completedCategories = completedCourses.map(p => {
      const course = this.courses.get(p.courseId);
      return course?.category;
    });

    if (completedCategories.includes('beginner')) {
      return '- Try intermediate courses\n- Explore advanced features\n- Consider admin training';
    } else if (completedCategories.includes('intermediate')) {
      return '- Explore advanced courses\n- Consider specialized training\n- Practice with hands-on projects';
    } else {
      return '- Start with beginner courses\n- Focus on fundamentals\n- Build strong foundation';
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initializeTrainingMaterials(): Promise<void> {
    console.log('🎓 Initializing Training Materials System...');

    // Create beginner courses
    await this.createCourse({
      id: 'user-authentication',
      title: 'User Authentication Fundamentals',
      description: 'Learn the basics of user authentication and security',
      category: 'beginner',
      duration: 45,
      modules: [
        {
          id: 'auth-basics',
          title: 'Authentication Basics',
          description: 'Understanding authentication concepts',
          type: 'video',
          duration: 15,
          content: [
            {
              id: 'intro',
              type: 'video',
              title: 'Introduction to Authentication',
              content: 'Learn about the importance of secure authentication',
              order: 1
            }
          ],
          exercises: [
            {
              id: 'auth-quiz',
              title: 'Authentication Quiz',
              description: 'Test your understanding of authentication',
              type: 'multiple-choice',
              instructions: ['Answer all questions', 'Review your answers'],
              expectedOutcome: 'Score 80% or higher',
              points: 10,
              timeLimit: 10
            }
          ],
          resources: [
            {
              id: 'auth-guide',
              title: 'Authentication Guide',
              type: 'document',
              url: '/docs/authentication-guide.pdf',
              description: 'Comprehensive authentication guide'
            }
          ]
        }
      ],
      prerequisites: ['Basic computer skills'],
      objectives: ['Understand authentication', 'Learn security best practices'],
      difficulty: 'easy',
      instructor: 'Security Team',
      lastUpdated: new Date(),
      version: '1.0.0'
    });

    // Create intermediate courses
    await this.createCourse({
      id: 'api-integration',
      title: 'API Integration Workshop',
      description: 'Hands-on workshop for integrating with Ads Pro Enterprise APIs',
      category: 'intermediate',
      duration: 120,
      modules: [
        {
          id: 'api-basics',
          title: 'API Fundamentals',
          description: 'Understanding REST APIs and authentication',
          type: 'interactive',
          duration: 30,
          content: [
            {
              id: 'rest-intro',
              type: 'text',
              title: 'REST API Introduction',
              content: 'Learn about REST principles and HTTP methods',
              order: 1
            },
            {
              id: 'auth-tokens',
              type: 'code',
              title: 'Authentication Tokens',
              content: 'Understanding JWT tokens and API keys',
              order: 2
            }
          ],
          exercises: [
            {
              id: 'api-exercise',
              title: 'API Authentication Exercise',
              description: 'Practice authenticating with the API',
              type: 'hands-on',
              instructions: ['Get API key', 'Make authenticated request', 'Handle response'],
              expectedOutcome: 'Successfully authenticate and retrieve data',
              points: 20,
              timeLimit: 30
            }
          ],
          resources: [
            {
              id: 'api-docs',
              title: 'API Documentation',
              type: 'link',
              url: '/api/docs',
              description: 'Complete API documentation'
            }
          ]
        }
      ],
      prerequisites: ['Basic programming knowledge', 'Understanding of HTTP'],
      objectives: ['Understand API authentication', 'Make API requests', 'Handle responses'],
      difficulty: 'medium',
      instructor: 'Development Team',
      lastUpdated: new Date(),
      version: '1.0.0'
    });

    // Create learning paths
    await this.createLearningPath({
      id: 'user-path',
      title: 'User Learning Path',
      description: 'Complete learning path for end users',
      targetRole: 'user',
      courses: ['user-authentication'],
      estimatedDuration: 2,
      difficulty: 'beginner',
      prerequisites: ['Basic computer skills'],
      outcomes: ['Understand authentication', 'Navigate the platform', 'Use basic features']
    });

    await this.createLearningPath({
      id: 'admin-path',
      title: 'Administrator Learning Path',
      description: 'Complete learning path for system administrators',
      targetRole: 'admin',
      courses: ['user-authentication', 'api-integration'],
      estimatedDuration: 4,
      difficulty: 'intermediate',
      prerequisites: ['Basic computer skills', 'System administration experience'],
      outcomes: ['Manage users', 'Configure system', 'Monitor performance']
    });

    console.log('✅ Training Materials System initialized');
  }
}

// ============================================================================
// REACT HOOKS FOR TRAINING INTEGRATION
// ============================================================================

export function useTrainingMaterials() {
  const [trainingSystem] = useState(() => new TrainingMaterialsSystem());
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);

  const getCourses = useCallback(() => {
    const allCourses = trainingSystem.getAllCourses();
    setCourses(allCourses);
    return allCourses;
  }, [trainingSystem]);

  const getLearningPaths = useCallback(() => {
    const allPaths = trainingSystem.getAllLearningPaths();
    setLearningPaths(allPaths);
    return allPaths;
  }, [trainingSystem]);

  const getMetrics = useCallback(() => {
    const currentMetrics = trainingSystem.getTrainingMetrics();
    setMetrics(currentMetrics);
    return currentMetrics;
  }, [trainingSystem]);

  const startCourse = useCallback(async (userId: string, courseId: string) => {
    await trainingSystem.startCourse(userId, courseId);
  }, [trainingSystem]);

  const updateProgress = useCallback(async (userId: string, courseId: string, moduleId: string, progress: number) => {
    await trainingSystem.updateProgress(userId, courseId, moduleId, progress);
  }, [trainingSystem]);

  const completeExercise = useCallback(async (userId: string, courseId: string, exerciseId: string, score: number) => {
    await trainingSystem.completeExercise(userId, courseId, exerciseId, score);
  }, [trainingSystem]);

  const getProgressReport = useCallback((userId: string) => {
    return trainingSystem.generateProgressReport(userId);
  }, [trainingSystem]);

  // Auto-update courses and paths
  useEffect(() => {
    getCourses();
    getLearningPaths();
    getMetrics();
  }, [getCourses, getLearningPaths, getMetrics]);

  return {
    trainingSystem,
    courses,
    learningPaths,
    metrics,
    startCourse,
    updateProgress,
    completeExercise,
    getProgressReport
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const trainingMaterialsSystem = new TrainingMaterialsSystem(); 