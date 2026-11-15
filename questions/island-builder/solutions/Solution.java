import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'countIslands' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts following parameters:
     *  1. INTEGER m
     *  2. INTEGER n
     *  3. 2D_INTEGER_ARRAY cells
     */

    public static List<Integer> countIslands(int m, int n, List<List<Integer>> cells) {
        // Union-find over the m * n cells (cell id r * n + c); parent[x] == -1 marks water.
        int[] parent = new int[m * n];
        int[] size = new int[m * n];
        Arrays.fill(parent, -1);
        int[] dr = {-1, 1, 0, 0}, dc = {0, 0, -1, 1};
        int islands = 0;
        List<Integer> result = new ArrayList<>(cells.size());
        for (List<Integer> raised : cells) {
            int r = raised.get(0), c = raised.get(1);
            int cell = r * n + c;
            if (parent[cell] == -1) {
                parent[cell] = cell;
                size[cell] = 1;
                islands++;
                for (int d = 0; d < 4; d++) {
                    int nr = r + dr[d], nc = c + dc[d];
                    if (nr < 0 || nr >= m || nc < 0 || nc >= n || parent[nr * n + nc] == -1) continue;
                    int a = find(parent, cell), b = find(parent, nr * n + nc);
                    if (a != b) {
                        if (size[a] < size[b]) { int t = a; a = b; b = t; }
                        parent[b] = a;
                        size[a] += size[b];
                        islands--;
                    }
                }
            }
            result.add(islands);
        }
        return result;
    }

    private static int find(int[] parent, int x) {
        int root = x;
        while (parent[root] != root) root = parent[root];
        while (parent[x] != root) {
            int next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int m = Integer.parseInt(firstMultipleInput[0]);

        int n = Integer.parseInt(firstMultipleInput[1]);

        int q = Integer.parseInt(firstMultipleInput[2]);

        List<List<Integer>> cells = new ArrayList<>();

        IntStream.range(0, q).forEach(i -> {
            try {
                cells.add(
                    Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
                        .map(Integer::parseInt)
                        .collect(toList())
                );
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        });

        List<Integer> result = Result.countIslands(m, n, cells);

        bufferedWriter.write(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
            + "\n"
        );

        bufferedReader.close();
        bufferedWriter.close();
    }
}
