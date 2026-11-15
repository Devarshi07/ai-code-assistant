package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

/*
 * Complete the 'countWays' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER amount
 *  2. INTEGER_ARRAY coins
 */

func countWays(amount int32, coins []int32) int32 {
    // Write your code here
    return 0
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    amountTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    amount := int32(amountTemp)

    coinsTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var coins []int32

    for i := 0; i < int(n); i++ {
        coinsItemTemp, err := strconv.ParseInt(coinsTemp[i], 10, 64)
        checkError(err)
        coinsItem := int32(coinsItemTemp)
        coins = append(coins, coinsItem)
    }

    result := countWays(amount, coins)

    fmt.Printf("%d\n", result)
}

func readLine(reader *bufio.Reader) string {
    str, _, err := reader.ReadLine()
    if err == io.EOF {
        return ""
    }

    return strings.TrimRight(string(str), "\r\n")
}

func checkError(err error) {
    if err != nil {
        panic(err)
    }
}
