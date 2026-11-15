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
 * Complete the 'auditLedger' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER b
 *  2. INTEGER_ARRAY transactions
 */

func auditLedger(b int32, transactions []int32) []int64 {
    balance := int64(b)
    lowest := balance
    firstNegative := int64(-1)
    for i, amount := range transactions {
        balance += int64(amount)
        if balance < 0 && firstNegative == -1 {
            firstNegative = int64(i + 1)
        }
        if balance < lowest {
            lowest = balance
        }
    }
    return []int64{firstNegative, lowest}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    bTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    b := int32(bTemp)

    transactionsTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var transactions []int32

    for i := 0; i < int(n); i++ {
        transactionsItemTemp, err := strconv.ParseInt(transactionsTemp[i], 10, 64)
        checkError(err)
        transactionsItem := int32(transactionsItemTemp)
        transactions = append(transactions, transactionsItem)
    }

    result := auditLedger(b, transactions)

    for i, resultItem := range result {
        fmt.Printf("%d", resultItem)

        if i != len(result) - 1 {
            fmt.Printf(" ")
        }
    }

    fmt.Printf("\n")
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
