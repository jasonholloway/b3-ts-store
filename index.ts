

for(let i = 1; i <= 100; i++) {
    const divisibleBy = n => i % n == 0;
  
    const line = divisibleBy(3)
                    ? (divisibleBy(5) 
                        ? 'CracklePop'
                        : 'Crackle')
                    : (divisibleBy(5) 
                        ? 'Pop' 
                        : i.toString());
  
    console.log(line);
  }