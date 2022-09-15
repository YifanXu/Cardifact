const addZero = (n) => n < 10 ? `0${n}` : n

export default function dateToString (unixTime) {
  const dateObj = new Date(unixTime)
  return `${addZero(dateObj.getHours())}:${addZero(dateObj.getMinutes())}:${addZero(dateObj.getSeconds())}`
}