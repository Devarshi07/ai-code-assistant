import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'auditLedger' function below.
     *
     * The function is expected to return a LONG_INTEGER_ARRAY.
     * The function accepts following parameters:
     *  1. INTEGER b
     *  2. INTEGER_ARRAY transactions
     */

    public static List<Long> auditLedger(int b, List<Integer> transactions) {
        long balance = b;
        long lowest = b;
        long firstNegative = -1;
        for (int i = 0; i < transactions.size(); i++) {
            balance += transactions.get(i);
            if (balance < 0 && firstNegative == -1) firstNegative = i + 1;
            if (balance < lowest) lowest = balance;
        }
        return Arrays.asList(firstNegative, lowest);
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int b = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> transactions = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Long> result = Result.auditLedger(b, transactions);

        System.out.println(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
        );

        bufferedReader.close();
    }
}
