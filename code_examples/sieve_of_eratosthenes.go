package main

import (
	"fmt"
	"time"
)

func SieveOfEratosthenes(n int) []int {
	if n < 2 {
		return []int{}
	}

	isPrime := make([]bool, n+1)
	for i := 2; i <= n; i++ {
		isPrime[i] = true
	}

	for p := 2; p*p <= n; p++ {
		if isPrime[p] {
			for multiple := p * p; multiple <= n; multiple += p {
				isPrime[multiple] = false
			}
		}
	}

	var primes []int
	for i := 2; i <= n; i++ {
		if isPrime[i] {
			primes = append(primes, i)
		}
	}

	return primes
}

func main() {
	n := 50
	start := time.Now()
	primes := SieveOfEratosthenes(n)
	elapsed := time.Since(start)
	fmt.Printf("Primes up to %d: %v\n", n, primes)
	fmt.Printf("Execution time: %s\n", elapsed)
}
