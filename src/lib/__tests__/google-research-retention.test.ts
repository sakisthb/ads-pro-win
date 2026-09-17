/** @jest-environment node */
jest.mock("@/lib/db",()=>({prisma:{analysis:{deleteMany:jest.fn()},prediction:{deleteMany:jest.fn()},optimization:{deleteMany:jest.fn()}}}));
import { prisma } from "@/lib/db";
import { aiDbService } from "../ai-database-service";

it("preserves saved Google evidence/review snapshots during legacy analytics retention cleanup",async()=>{
  jest.mocked(prisma.analysis.deleteMany).mockResolvedValue({count:0});
  jest.mocked(prisma.prediction.deleteMany).mockResolvedValue({count:0});
  jest.mocked(prisma.optimization.deleteMany).mockResolvedValue({count:0});
  await aiDbService.cleanupOldData("fixture-org",90);
  expect(prisma.analysis.deleteMany).toHaveBeenCalledWith({where:expect.objectContaining({organizationId:"fixture-org",type:{not:"google_audit_research_v1"}})});
});
