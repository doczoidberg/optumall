import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'amount'
})
export class AmountPipe implements PipeTransform {

  transform(value: number, ...args: unknown[]): unknown {
    var numervalue = args[0] as number;
    if (numervalue < 0)
      return '<span style="color:red;" class="amountnegative">' + value + '</span>';
    if (numervalue > 0)
      return '<span style="color:green;" class="amountpositive">' + value + '</span>';

    return value;

  }

}
