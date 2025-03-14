import React from 'react';
import { 
  Box,
  Paper, 
  Typography,
  Link,
  Button
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

function About() {
  return (
    <Paper elevation={3} sx={{ maxWidth: 800, margin: '20px auto', padding: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <DirectionsRunIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h5" gutterBottom sx={{ flex: 1 }}>
          About
        </Typography>
      </Box>
      
      <Button 
        component={RouterLink} 
        to="/" 
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 3 }}
      >
        Back
      </Button>

      <Typography variant="body1" paragraph>
      What is more frustrating than when you are finally well prepared for your weekend long run(or that 5k ultra) just to find out the park is occupied by another event.
      </Typography>

      <Typography variant="body1" paragraph>
      With <Link component={RouterLink} to="/" color="primary">centralpark.run</Link>, you can easily check for events in the Central Park to avoid running into a race you are not participating...
      </Typography>

      <Typography variant="body1" paragraph>
        centralpark.run automatically fetch the latest events from various sources weekly and uses generative AI to parse and aggregate events that are happening in the Central Park. So you will know before you go whether you should be running in the park or avoid it that day, or even join the event!
      </Typography>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Support centralpark.run
      </Typography>
      
      <Typography variant="body1" paragraph>
        Even though this is pretty bare bones, it costs me some $ to build it, like domain name, GenAI API costs.
        If you find this tool helpful for your running routine, please consider supporting it:
      </Typography>
      
      <Box sx={{ ml: 2, mb: 2 }}>
        <Typography variant="body1" paragraph>
          • <Link href="https://github.com/minimumviablestack/central-park-run-calendar" target="_blank" rel="noopener">Star the project on GitHub</Link>
        </Typography>
        <Typography variant="body1" paragraph>
          • <Link href="https://github.com/minimumviablestack/central-park-run-calendar/issues" target="_blank" rel="noopener">Submit feedback or feature requests, help me build this better.</Link>
        </Typography>
        <Typography variant="body1" paragraph>
          • Share with fellow runners in your community
        </Typography>
        <Typography variant="body1" paragraph>
          • If you are interested in buying running gears, use my referral links(so I can spend even more on running gears XD):
            <Box sx={{ ml: 3, mt: 1 }}>
              <Typography variant="body2" paragraph>
                ◦ <Link 
                    href="https://r.infl.co/wnd0R76UIi5" 
                    target="_blank" 
                    rel="noopener"
                    color="primary"
                  >
                    Soar running referral
                  </Link>
              </Typography>
            </Box>
        </Typography>
        <Typography variant="body1" paragraph>
          • Crypto(ETH or ERC-20) tip jar: 
            <Typography component="span" sx={{ ml: 1, color: 'text.secondary', fontSize: '0.85rem', wordBreak: 'break-all' }}>
              (0xe018D2D302EC79d4Ee3f712d344aA8d221b427EB)
            </Typography>
            <Button 
              color="primary"
              size="small"
              onClick={() => {
                const ethAddress = '0xe018D2D302EC79d4Ee3f712d344aA8d221b427EB';
                if (window.ethereum) {
                  // Ensure the address is properly formatted with 0x prefix
                  const formattedAddress = ethAddress.startsWith('0x') ? ethAddress : `0x${ethAddress}`;
                  
                  // Request account access if needed
                  window.ethereum.request({ method: 'eth_requestAccounts' })
                    .then(accounts => {
                      // Create transaction parameters
                      const transactionParameters = {
                        to: formattedAddress,
                        from: accounts[0], // The currently connected wallet address
                        value: '0x11c37937e08000', // 0.005 ETH in hex
                      };
                      
                      // Send the transaction
                      window.ethereum.request({
                        method: 'eth_sendTransaction',
                        params: [transactionParameters],
                      })
                      .catch(error => {
                        console.error('Transaction error:', error);
                        alert('Transaction failed. See console for details.');
                      });
                    })
                    .catch(error => {
                      console.error('Account access error:', error);
                      alert('Could not access your Ethereum wallet.');
                    });
                } else {
                  window.open(`https://etherscan.io/address/${ethAddress}`, '_blank');
                  alert('MetaMask not detected. Please install MetaMask to send ETH directly.');
                }
              }}
              sx={{ ml: 1, textTransform: 'none' }}
            >
             Tip via MetaMask
            </Button>
            
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ mt: 4, textAlign: 'center', color: 'text.secondary' }}>
        Created by a runner, for all runners. Happy running!
      </Typography>

      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Disclaimer
        </Typography>
        <Typography variant="body2">
          centralpark.run is not affiliated with, endorsed by, or in any way officially connected (except I love them) with Central Park, New York Road Runners (NYRR), dressmyrun.com, or any of the other data sources used on this website. All event information is aggregated from publicly available sources for informational purposes only.
        </Typography>
      </Box>
    </Paper>
  );
}

export default About;