import fs from 'fs';
import path from 'path';
import { withAuth, withRateLimit } from '../../src/middleware/auth';
import { withFullSecurity } from '../../src/middleware/security';

// Apply comprehensive security, rate limiting and authentication middleware
const handler = withFullSecurity(
  withRateLimit({ maxRequests: 100, windowMs: 15 * 60 * 1000 })(
    withAuth(async (req, res) => {
      if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
      }

      try {
        const { contract } = req.query;
        
        if (contract) {
          // Return specific contract artifact
          const artifactPath = path.join(process.cwd(), 'artifacts', 'contracts', `${contract}.sol`, `${contract}.json`);
          
          if (!fs.existsSync(artifactPath)) {
            return res.status(404).json({ message: 'Contract artifact not found' });
          }

          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          
          // Return only the necessary parts for deployment
          const deploymentArtifact = {
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            contractName: artifact.contractName
          };

          res.status(200).json(deploymentArtifact);
        } else {
          // Return all available contract artifacts
          const contractsDir = path.join(process.cwd(), 'artifacts', 'contracts');
          
          if (!fs.existsSync(contractsDir)) {
            return res.status(200).json([]);
          }

          const contracts = [];
          const contractDirs = fs.readdirSync(contractsDir);
          
          for (const contractDir of contractDirs) {
            if (contractDir.endsWith('.sol')) {
              const contractName = contractDir.replace('.sol', '');
              const artifactPath = path.join(contractsDir, contractDir, `${contractName}.json`);
              
              if (fs.existsSync(artifactPath)) {
                try {
                  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                  contracts.push({
                    abi: artifact.abi,
                    bytecode: artifact.bytecode,
                    contractName: artifact.contractName
                  });
                } catch (error) {
                  console.log(`Failed to parse artifact for ${contractName}:`, error.message);
                }
              }
            }
          }

          res.status(200).json(contracts);
        }
      } catch (error) {
        console.error('Error reading contract artifacts:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    })
  ),
  {
    maxRequestSize: '10mb', // Larger size for contract artifacts
    enableCORS: true,
    enableInputValidation: true
  }
);

export default handler;
